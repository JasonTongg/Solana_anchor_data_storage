import * as anchor from "@anchor-lang/core";
import fs from "fs";
import path from "path";
import os from "os";

const PROGRAM_ID = new anchor.web3.PublicKey(
	"DLrc7vnZPLs3kbUGxFRSZ3LqcHzEzUWuCDjc9qzy6vVA",
);
const DEVNET_URL = "https://api.devnet.solana.com";
const IDL_PATH = path.join(__dirname, "../target/idl/simpan_data.json");
const WALLET_PATH = path.join(os.homedir(), ".config/solana/id.json");

const MAX_INDEX = 99;

// ── Helpers ───────────────────────────────────────────────────────────────────

function step(n: number, total: number, msg: string) {
	console.log(`[${n}/${total}] ${msg}`);
}

function deriveDataPda(
	callerPubkey: anchor.web3.PublicKey,
	index: number,
): anchor.web3.PublicKey {
	const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
		[
			Buffer.from("data"),
			callerPubkey.toBuffer(),
			new anchor.BN(index).toArrayLike(Buffer, "le", 8),
		],
		PROGRAM_ID,
	);
	return pda;
}

function deriveUserProfilePda(
	callerPubkey: anchor.web3.PublicKey,
): anchor.web3.PublicKey {
	const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
		[Buffer.from("akun"), callerPubkey.toBuffer()],
		PROGRAM_ID,
	);
	return pda;
}

function explorerLink(tx: string) {
	return `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
}

function lamportsToSol(lamports: number) {
	return (lamports / anchor.web3.LAMPORTS_PER_SOL).toFixed(6);
}

// ── Functions ─────────────────────────────────────────────────────────────────

async function register(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	name: string,
) {
	console.log("\n=== REGISTER ===");

	step(1, 4, "Menghitung alamat UserProfile PDA...");
	const profilePda = deriveUserProfilePda(callerPubkey);
	console.log(`       PDA : ${profilePda.toBase58()}`);

	step(2, 4, "Mengecek apakah sudah terdaftar...");
	const exists = await connection.getAccountInfo(profilePda);
	if (exists) {
		const profile = await program.account.akunUser.fetch(profilePda);
		console.log(`       Sudah terdaftar sebagai '${profile.nama}'.`);
		return;
	}
	console.log("       Belum terdaftar, lanjut register...");

	step(3, 4, `Mengirim transaksi register_user(name="${name}") ke devnet...`);
	const tx = await program.methods
		.registerAkun(name)
		.accounts({
			akunUser: profilePda,
			caller: callerPubkey,
			systemProgram: anchor.web3.SystemProgram.programId,
		})
		.rpc();
	console.log(`       Signature : ${tx}`);

	step(4, 4, "Transaksi dikonfirmasi! Membaca profil...");
	const profile = await program.account.akunUser.fetch(profilePda);
	console.log(`\n  Nama       : ${profile.nama}`);
	console.log(`  Owner      : ${profile.owner.toBase58()}`);
	console.log(`  Total data : ${profile.total}`);
	console.log(`\n  Explorer : ${explorerLink(tx)}`);
}

async function profile(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
) {
	console.log("\n=== PROFILE ===");

	step(1, 2, "Menghitung alamat UserProfile PDA...");
	const profilePda = deriveUserProfilePda(callerPubkey);
	console.log(`       PDA : ${profilePda.toBase58()}`);

	step(2, 2, "Membaca profil dari blockchain...");
	const exists = await connection.getAccountInfo(profilePda);
	if (!exists) {
		console.log("       Profil belum ada. Daftar dulu dengan 'register <nama>'.");
		return;
	}

	const data = await program.account.akunUser.fetch(profilePda);
	console.log(`\n  Nama       : ${data.nama}`);
	console.log(`  Owner      : ${data.owner.toBase58()}`);
	console.log(`  Total data : ${data.total}`);
}

async function create(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	index: number,
	value: number,
) {
	console.log("\n=== CREATE ===");

	step(1, 5, "Menghitung alamat PDA...");
	const pdaAddress  = deriveDataPda(callerPubkey, index);
	const profilePda  = deriveUserProfilePda(callerPubkey);
	console.log(`       Data PDA    : ${pdaAddress.toBase58()}`);
	console.log(`       Profile PDA : ${profilePda.toBase58()}`);

	step(2, 5, "Mengecek UserProfile...");
	const profileExists = await connection.getAccountInfo(profilePda);
	if (!profileExists) {
		console.log("       Belum register! Jalankan 'register <nama>' dulu.");
		return;
	}
	const profileBefore = await program.account.akunUser.fetch(profilePda);
	console.log(`       User    : ${profileBefore.nama} (total data: ${profileBefore.total})`);

	step(3, 5, "Mengecek apakah akun data sudah ada...");
	const dataExists = await connection.getAccountInfo(pdaAddress);
	if (dataExists) {
		console.log(`       Akun index ${index} sudah ada. Gunakan 'update'.`);
		return;
	}
	console.log("       Belum ada, lanjut membuat...");

	step(4, 5, `Mengirim transaksi buat_data(index=${index}, value=${value})...`);
	const balanceBefore = await connection.getBalance(callerPubkey);
	const tx = await program.methods
		.buatAkun(new anchor.BN(index), new anchor.BN(value))
		.accounts({
			akunDataUser: pdaAddress,
			akunUser:  profilePda,
			caller:       callerPubkey,
			systemProgram: anchor.web3.SystemProgram.programId,
		})
		.rpc();
	console.log(`       Signature : ${tx}`);

	step(5, 5, "Dikonfirmasi! Verifikasi data & profil...");
	const account       = await program.account.dataUser.fetch(pdaAddress);
	const profileAfter  = await program.account.akunUser.fetch(profilePda);
	const balanceAfter  = await connection.getBalance(callerPubkey);
	console.log(`       Value tersimpan : ${account.data.toString()}`);
	console.log(`       Owner           : ${account.owner.toBase58()}`);
	console.log(`       Total data user : ${profileBefore.total} → ${profileAfter.total}`);
	console.log(`       SOL terpakai    : ${lamportsToSol(balanceBefore - balanceAfter)} SOL`);
	console.log(`\n  Explorer : ${explorerLink(tx)}`);
}

async function read(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	index: number,
) {
	console.log("\n=== READ ===");

	step(1, 3, "Menghitung alamat PDA...");
	const pdaAddress = deriveDataPda(callerPubkey, index);
	console.log(`       PDA : ${pdaAddress.toBase58()}`);

	step(2, 3, "Mengecek akun di blockchain...");
	const exists = await connection.getAccountInfo(pdaAddress);
	if (!exists) {
		console.log(`       Akun index ${index} tidak ditemukan.`);
		return;
	}
	console.log(`       Akun ditemukan (${exists.data.length} bytes)`);

	step(3, 3, "Membaca data...");
	const account = await program.account.dataUser.fetch(pdaAddress);
	console.log(`\n  Index : ${index}`);
	console.log(`  Value : ${account.data.toString()}`);
	console.log(`  Owner : ${account.owner.toBase58()}`);
}

async function update(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	index: number,
	value: number,
) {
	console.log("\n=== UPDATE ===");

	step(1, 5, "Menghitung alamat PDA...");
	const pdaAddress = deriveDataPda(callerPubkey, index);
	console.log(`       PDA : ${pdaAddress.toBase58()}`);

	step(2, 5, "Mengecek akun di blockchain...");
	const exists = await connection.getAccountInfo(pdaAddress);
	if (!exists) {
		console.log(`       Akun index ${index} tidak ditemukan. Buat dulu dengan 'create'.`);
		return;
	}

	step(3, 5, "Membaca nilai lama...");
	const before = await program.account.dataUser.fetch(pdaAddress);
	console.log(`       Value lama : ${before.data.toString()}`);

	step(4, 5, `Mengirim transaksi update_data(index=${index}, value=${value})...`);
	const tx = await program.methods
		.updateAkun(new anchor.BN(index), new anchor.BN(value))
		.accounts({
			akunDataUser: pdaAddress,
			caller:       callerPubkey,
		})
		.rpc();
	console.log(`       Signature : ${tx}`);

	step(5, 5, "Dikonfirmasi! Verifikasi nilai baru...");
	const after = await program.account.dataUser.fetch(pdaAddress);
	console.log(`       Value baru : ${after.data.toString()}`);
	console.log(`\n  Explorer : ${explorerLink(tx)}`);
}

async function hapus(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	index: number,
) {
	console.log("\n=== DELETE ===");

	step(1, 5, "Menghitung alamat PDA...");
	const pdaAddress = deriveDataPda(callerPubkey, index);
	const profilePda = deriveUserProfilePda(callerPubkey);
	console.log(`       Data PDA    : ${pdaAddress.toBase58()}`);
	console.log(`       Profile PDA : ${profilePda.toBase58()}`);

	step(2, 5, "Mengecek akun data...");
	const exists = await connection.getAccountInfo(pdaAddress);
	if (!exists) {
		console.log(`       Akun index ${index} tidak ditemukan.`);
		return;
	}
	console.log(`       Rent yang dikembalikan: ${lamportsToSol(exists.lamports)} SOL`);

	step(3, 5, "Membaca total data sebelum hapus...");
	const profileBefore = await program.account.akunUser.fetch(profilePda);
	console.log(`       Total data sekarang : ${profileBefore.total}`);

	step(4, 5, `Mengirim transaksi delete_data(index=${index})...`);
	const tx = await program.methods
		.deleteAkun(new anchor.BN(index))
		.accounts({
			akunDataUser: pdaAddress,
			akunUser:  profilePda,
			caller:       callerPubkey,
		})
		.rpc();
	console.log(`       Signature : ${tx}`);

	step(5, 5, "Dikonfirmasi! Verifikasi akun terhapus & profil terupdate...");
	const afterDelete   = await connection.getAccountInfo(pdaAddress);
	const profileAfter  = await program.account.akunUser.fetch(profilePda);
	console.log(`       Status akun     : ${afterDelete === null ? "sudah terhapus ✓" : "masih ada"}`);
	console.log(`       Total data user : ${profileBefore.total} → ${profileAfter.total}`);
	console.log(`\n  Explorer : ${explorerLink(tx)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const USAGE = `
Penggunaan:
  yarn interact register <nama>         — daftar user profile
  yarn interact profile                 — lihat profil user
  yarn interact create <index> <value>  — buat data baru
  yarn interact read   <index>          — baca data
  yarn interact update <index> <value>  — update nilai data
  yarn interact delete <index>          — hapus data

Contoh:
  yarn interact register Jason
  yarn interact profile
  yarn interact create 0 42
  yarn interact read   0
  yarn interact update 0 99
  yarn interact delete 0
`;

const COMMANDS = ["register", "profile", "create", "read", "update", "delete"];

async function main() {
	const args    = process.argv.slice(2);
	const command = args[0];
	const index   = parseInt(args[1] ?? "0");
	const value   = parseInt(args[2] ?? "0");
	const name    = args[1] ?? "";

	if (!COMMANDS.includes(command)) {
		console.log(USAGE);
		process.exit(0);
	}

	console.log("Memuat wallet...");
	const rawKey  = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
	const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(rawKey));
	console.log(`  Wallet : ${keypair.publicKey.toBase58()}`);

	console.log("Menghubungkan ke devnet...");
	const connection = new anchor.web3.Connection(DEVNET_URL, "confirmed");
	const wallet     = new anchor.Wallet(keypair);
	const provider   = new anchor.AnchorProvider(connection, wallet, {
		commitment: "confirmed",
		preflightCommitment: "confirmed",
	});
	anchor.setProvider(provider);

	console.log("Memuat IDL program...");
	const idl     = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
	const program  = new anchor.Program(idl, provider) as any;
	console.log(`  Program : ${PROGRAM_ID.toBase58()}`);

	switch (command) {
		case "register": await register(program, connection, keypair.publicKey, name); break;
		case "profile":  await profile(program, connection, keypair.publicKey); break;
		case "create":   await create(program, connection, keypair.publicKey, index, value); break;
		case "read":     await read(program, connection, keypair.publicKey, index); break;
		case "update":   await update(program, connection, keypair.publicKey, index, value); break;
		case "delete":   await hapus(program, connection, keypair.publicKey, index); break;
	}
}

main().catch((err) => {
	console.error("Error:", err.message ?? err);
	process.exit(1);
});
