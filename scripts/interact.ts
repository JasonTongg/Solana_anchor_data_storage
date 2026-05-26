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

function derivePda(
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

function explorerLink(tx: string) {
	return `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
}

function lamportsToSol(lamports: number) {
	return (lamports / anchor.web3.LAMPORTS_PER_SOL).toFixed(6);
}

// ── CRUD functions ────────────────────────────────────────────────────────────

async function create(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	index: number,
	value: number,
) {
	console.log("\n=== CREATE ===");

	// if (index > MAX_INDEX) {
	// 	console.error(`Error: index ${index} melebihi batas maksimum (maks: ${MAX_INDEX})`);
	// 	return;
	// }
	// if (value <= 0) {
	// 	console.error(`Error: value tidak boleh nol atau negatif`);
	// 	return;
	// }

	step(1, 5, "Menghitung alamat PDA dari seeds...");
	const pdaAddress = derivePda(callerPubkey, index);
	console.log(`       PDA : ${pdaAddress.toBase58()}`);

	step(2, 5, "Mengecek apakah akun sudah ada di blockchain...");
	const exists = await connection.getAccountInfo(pdaAddress);
	if (exists) {
		console.log(`       Akun index ${index} sudah ada. Gunakan 'update' untuk mengubah nilainya.`);
		return;
	}
	console.log("       Akun belum ada, lanjut membuat...");

	step(3, 5, "Mengecek saldo SOL wallet sebelum transaksi...");
	const balanceBefore = await connection.getBalance(callerPubkey);
	console.log(`       Saldo : ${lamportsToSol(balanceBefore)} SOL`);

	step(4, 5, `Mengirim transaksi buat_data(index=${index}, value=${value}) ke devnet...`);
	const tx = await program.methods
		.buatData(new anchor.BN(index), new anchor.BN(value))
		.accounts({
			akunDataSaya: pdaAddress,
			caller: callerPubkey,
			systemProgram: anchor.web3.SystemProgram.programId,
		})
		.rpc();
	console.log(`       Signature : ${tx}`);

	step(5, 5, "Transaksi dikonfirmasi! Membaca data yang tersimpan...");
	const account = await program.account.dataSaya.fetch(pdaAddress);
	const balanceAfter = await connection.getBalance(callerPubkey);
	console.log(`       Value tersimpan : ${account.data.toString()}`);
	console.log(`       Saldo sekarang  : ${lamportsToSol(balanceAfter)} SOL`);
	console.log(`       SOL terpakai    : ${lamportsToSol(balanceBefore - balanceAfter)} SOL (rent akun)`);
	console.log(`\n  Explorer : ${explorerLink(tx)}`);
}

async function read(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	index: number,
) {
	console.log("\n=== READ ===");

	step(1, 3, "Menghitung alamat PDA dari seeds...");
	const pdaAddress = derivePda(callerPubkey, index);
	console.log(`       PDA : ${pdaAddress.toBase58()}`);

	step(2, 3, "Mengecek akun di blockchain...");
	const exists = await connection.getAccountInfo(pdaAddress);
	if (!exists) {
		console.log(`       Akun index ${index} tidak ditemukan. Buat dulu dengan 'create'.`);
		return;
	}
	console.log(`       Akun ditemukan (${exists.data.length} bytes)`);

	step(3, 3, "Membaca dan deserialize data dari akun...");
	const account = await program.account.dataSaya.fetch(pdaAddress);
	console.log(`\n  Index : ${index}`);
	console.log(`  PDA   : ${pdaAddress.toBase58()}`);
	console.log(`  Value : ${account.data.toString()}`);
}

async function update(
	program: any,
	connection: anchor.web3.Connection,
	callerPubkey: anchor.web3.PublicKey,
	index: number,
	value: number,
) {
	console.log("\n=== UPDATE ===");

	// if (index > MAX_INDEX) {
	// 	console.error(`Error: index ${index} melebihi batas maksimum (maks: ${MAX_INDEX})`);
	// 	return;
	// }
	// if (value <= 0) {
	// 	console.error(`Error: value tidak boleh nol atau negatif`);
	// 	return;
	// }

	step(1, 5, "Menghitung alamat PDA dari seeds...");
	const pdaAddress = derivePda(callerPubkey, index);
	console.log(`       PDA : ${pdaAddress.toBase58()}`);

	step(2, 5, "Mengecek akun di blockchain...");
	const exists = await connection.getAccountInfo(pdaAddress);
	if (!exists) {
		console.log(`       Akun index ${index} tidak ditemukan. Buat dulu dengan 'create'.`);
		return;
	}
	console.log("       Akun ditemukan!");

	step(3, 5, "Membaca nilai lama...");
	const before = await program.account.dataSaya.fetch(pdaAddress);
	console.log(`       Value lama : ${before.data.toString()}`);

	step(4, 5, `Mengirim transaksi update_data(index=${index}, value=${value}) ke devnet...`);
	const tx = await program.methods
		.updateData(new anchor.BN(index), new anchor.BN(value))
		.accounts({
			akunDataSaya: pdaAddress,
			caller: callerPubkey,
		})
		.rpc();
	console.log(`       Signature : ${tx}`);

	step(5, 5, "Transaksi dikonfirmasi! Verifikasi nilai baru...");
	const after = await program.account.dataSaya.fetch(pdaAddress);
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

	step(1, 4, "Menghitung alamat PDA dari seeds...");
	const pdaAddress = derivePda(callerPubkey, index);
	console.log(`       PDA : ${pdaAddress.toBase58()}`);

	step(2, 4, "Mengecek akun di blockchain...");
	const exists = await connection.getAccountInfo(pdaAddress);
	if (!exists) {
		console.log(`       Akun index ${index} tidak ditemukan.`);
		return;
	}
	const rentLamports = exists.lamports;
	console.log(`       Akun ditemukan! Rent yang akan dikembalikan: ${lamportsToSol(rentLamports)} SOL`);

	step(3, 4, `Mengirim transaksi delete_data(index=${index}) ke devnet...`);
	const tx = await program.methods
		.deleteData(new anchor.BN(index))
		.accounts({
			akunDataSaya: pdaAddress,
			caller: callerPubkey,
		})
		.rpc();
	console.log(`       Signature : ${tx}`);

	step(4, 4, "Transaksi dikonfirmasi! Verifikasi akun sudah terhapus...");
	const afterDelete = await connection.getAccountInfo(pdaAddress);
	console.log(`       Status akun : ${afterDelete === null ? "sudah terhapus ✓" : "masih ada (tunggu konfirmasi)"}`);
	console.log(`\n  Explorer : ${explorerLink(tx)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const USAGE = `
Penggunaan:
  yarn interact create <index> <value>  — buat data baru
  yarn interact read   <index>          — baca data
  yarn interact update <index> <value>  — update nilai data
  yarn interact delete <index>          — hapus data dan kembalikan SOL

Contoh:
  yarn interact create 0 42
  yarn interact read   0
  yarn interact update 0 99
  yarn interact delete 0
`;

async function main() {
	const args = process.argv.slice(2);
	const command = args[0];
	const index = parseInt(args[1] ?? "0");
	const value = parseInt(args[2] ?? "0");

	if (!["create", "read", "update", "delete"].includes(command)) {
		console.log(USAGE);
		process.exit(0);
	}

	console.log("Memuat wallet...");
	const rawKey = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
	const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(rawKey));
	console.log(`  Wallet : ${keypair.publicKey.toBase58()}`);

	console.log("Menghubungkan ke devnet...");
	const connection = new anchor.web3.Connection(DEVNET_URL, "confirmed");
	const wallet = new anchor.Wallet(keypair);
	const provider = new anchor.AnchorProvider(connection, wallet, {
		commitment: "confirmed",
		preflightCommitment: "confirmed",
	});
	anchor.setProvider(provider);

	console.log("Memuat IDL program...");
	const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
	const program = new anchor.Program(idl, provider) as any;
	console.log(`  Program : ${PROGRAM_ID.toBase58()}`);

	switch (command) {
		case "create": await create(program, connection, keypair.publicKey, index, value); break;
		case "read":   await read(program, connection, keypair.publicKey, index); break;
		case "update": await update(program, connection, keypair.publicKey, index, value); break;
		case "delete": await hapus(program, connection, keypair.publicKey, index); break;
	}
}

main().catch((err) => {
	console.error("Error:", err.message ?? err);
	process.exit(1);
});
