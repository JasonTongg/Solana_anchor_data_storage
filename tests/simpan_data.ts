import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SimpanData } from "../target/types/simpan_data";
import { expect } from "chai";

const PROGRAM_ID = new anchor.web3.PublicKey(
  "DyK22yV8aBuyYSHw9kRnrR2UYBnVDasxczsLSQ2uVpEb"
);

function deriveAccountPda(user: anchor.web3.PublicKey): anchor.web3.PublicKey {
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user-account"), user.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

function deriveDataPda(
  user: anchor.web3.PublicKey,
  index: number
): anchor.web3.PublicKey {
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("user-data"),
      user.toBuffer(),
      new anchor.BN(index).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
  return pda;
}

describe("simpan_data", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SimpanData as Program<SimpanData>;
  const user = provider.wallet.publicKey;

  // ── initialize_account ────────────────────────────────────────────────────

  describe("initialize_account", () => {
    it("creates an account with correct fields", async () => {
      const accountPda = deriveAccountPda(user);

      await program.methods
        .initializeAccount("Jason")
        .accounts({ userAccount: accountPda, caller: user })
        .rpc();

      const account = await program.account.userAccount.fetch(accountPda);
      expect(account.name).to.equal("Jason");
      expect(account.owner.toBase58()).to.equal(user.toBase58());
      expect(account.total).to.equal(0);
    });

    it("fails when name is empty", async () => {
      const accountPda = deriveAccountPda(user);
      try {
        await program.methods
          .initializeAccount("")
          .accounts({ userAccount: accountPda, caller: user })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("EmptyName");
      }
    });

    it("fails when name exceeds max length", async () => {
      const accountPda = deriveAccountPda(user);
      const longName = "a".repeat(101);
      try {
        await program.methods
          .initializeAccount(longName)
          .accounts({ userAccount: accountPda, caller: user })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("StringTooLong");
      }
    });
  });

  // ── initialize_data ───────────────────────────────────────────────────────

  describe("initialize_data", () => {
    it("creates data at index 0 with correct fields", async () => {
      const accountPda = deriveAccountPda(user);
      const dataPda = deriveDataPda(user, 0);

      await program.methods
        .initializeData(new anchor.BN(0), new anchor.BN(42))
        .accounts({ userData: dataPda, userAccount: accountPda, caller: user })
        .rpc();

      const data = await program.account.userData.fetch(dataPda);
      expect(data.data.toNumber()).to.equal(42);
      expect(data.owner.toBase58()).to.equal(user.toBase58());

      const account = await program.account.userAccount.fetch(accountPda);
      expect(account.total).to.equal(1);
    });

    it("fails when data is 0", async () => {
      const accountPda = deriveAccountPda(user);
      const dataPda = deriveDataPda(user, 1);
      try {
        await program.methods
          .initializeData(new anchor.BN(1), new anchor.BN(0))
          .accounts({ userData: dataPda, userAccount: accountPda, caller: user })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("EmptyData");
      }
    });

    it("fails when index is out of bounds", async () => {
      const accountPda = deriveAccountPda(user);
      const dataPda = deriveDataPda(user, 100);
      try {
        await program.methods
          .initializeData(new anchor.BN(100), new anchor.BN(5))
          .accounts({ userData: dataPda, userAccount: accountPda, caller: user })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("IndexOutOfBounds");
      }
    });
  });

  // ── update_data ───────────────────────────────────────────────────────────

  describe("update_data", () => {
    it("updates data at index 0 to a new value", async () => {
      const dataPda = deriveDataPda(user, 0);

      await program.methods
        .updateData(new anchor.BN(0), new anchor.BN(99))
        .accounts({ userData: dataPda, caller: user })
        .rpc();

      const data = await program.account.userData.fetch(dataPda);
      expect(data.data.toNumber()).to.equal(99);
    });

    it("fails when new value is same as old value", async () => {
      const dataPda = deriveDataPda(user, 0);
      try {
        await program.methods
          .updateData(new anchor.BN(0), new anchor.BN(99))
          .accounts({ userData: dataPda, caller: user })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("DataNotChanged");
      }
    });

    it("fails when new value is 0", async () => {
      const dataPda = deriveDataPda(user, 0);
      try {
        await program.methods
          .updateData(new anchor.BN(0), new anchor.BN(0))
          .accounts({ userData: dataPda, caller: user })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("EmptyData");
      }
    });
  });

  // ── delete_data ───────────────────────────────────────────────────────────

  describe("delete_data", () => {
    it("deletes data at index 0 and decrements total", async () => {
      const accountPda = deriveAccountPda(user);
      const dataPda = deriveDataPda(user, 0);

      const before = await program.account.userAccount.fetch(accountPda);

      await program.methods
        .deleteData(new anchor.BN(0))
        .accounts({ userData: dataPda, userAccount: accountPda, caller: user })
        .rpc();

      const after = await program.account.userAccount.fetch(accountPda);
      expect(after.total).to.equal(before.total - 1);

      const deleted = await provider.connection.getAccountInfo(dataPda);
      expect(deleted).to.be.null;
    });
  });
});
