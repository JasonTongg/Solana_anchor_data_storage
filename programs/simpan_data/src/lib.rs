use anchor_lang::prelude::*;

declare_id!("DLrc7vnZPLs3kbUGxFRSZ3LqcHzEzUWuCDjc9qzy6vVA");

pub const MAX_INDEX: u64 = 99;
pub const MAX_NAME_LEN: usize = 99;

#[error_code]
pub enum AppError {
    #[msg("Data tidak boleh nol")]
    DataNol,

    #[msg("Data tidak berubah")]
    DataTidakBerubah,

    #[msg("Index lebih dari 99")]
    IndexLebihDari99,

    #[msg("Nama tidak boleh kosong")]
    NamaKosong,

    #[msg("Nama terlalu panjang")]
    NamaTerlaluPanjang
}

#[account]
pub struct AkunUser {
    owner: Pubkey,
    nama: String,
    total: u32
}

#[account]
pub struct DataUser {
    owner: Pubkey,
    data: u64
}

#[derive(Accounts)]
pub struct RegisterAkun<'info> {
    #[account(
        init,
        space = 8 + 32 + 4 + MAX_NAME_LEN + 4,
        payer = caller,
        seeds = [b"akun", caller.key().as_ref()],
        bump
    )]
    pub akun_user: Account<'info, AkunUser>,

    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct BuatAkun<'info> {
    #[account(
        init,
        space = 8 + 32 + 8,
        payer = caller,
        seeds = [b"data", caller.key().as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub akun_data_user: Account<'info, DataUser>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"akun", caller.key().as_ref()],
        bump
    )]
    pub akun_user: Account<'info, AkunUser>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct UpdateAkun<'info> {
    #[account(
        mut,
        seeds = [b"data", caller.key().as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub akun_data_user: Account<'info, DataUser>,

    #[account(mut)]
    pub caller: Signer<'info>
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct DeleteAkun<'info> {
    #[account(
        mut,
        seeds = [b"data", caller.key().as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub akun_data_user: Account<'info, DataUser>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"akun", caller.key().as_ref()],
        bump
    )]
    pub akun_user: Account<'info, AkunUser>
}

#[program]
pub mod simpan_data {
    use super::*;
    
    pub fn register_akun(ctx: Context<RegisterAkun>, nama: String) -> Result<()> {
        require!(nama.len() > 0, AppError::NamaKosong);
        require!(nama.len() < MAX_NAME_LEN, AppError::NamaTerlaluPanjang);

        ctx.accounts.akun_user.nama = nama.clone();
        ctx.accounts.akun_user.owner = ctx.accounts.caller.key();
        ctx.accounts.akun_user.total = 0;
        msg!("Berhasil registrasi akun dengan nama {}", nama);
        Ok(())
    }

    pub fn buat_akun(ctx: Context<BuatAkun>, index: u64, new_data: u64) -> Result<()> {
        require!(index <= MAX_INDEX, AppError::IndexLebihDari99 );
        require!(new_data != 0, AppError::DataNol);
        ctx.accounts.akun_data_user.data = new_data;
        ctx.accounts.akun_data_user.owner = ctx.accounts.caller.key();
        ctx.accounts.akun_user.total += 1;

        msg!("Data berhasil dibuat ke {} dengan index {}", new_data, index);
        Ok(())
    }

    pub fn update_akun(ctx: Context<UpdateAkun>, index: u64, new_data: u64) -> Result<()> {
        require!(index <= MAX_INDEX, AppError::IndexLebihDari99 );
        require!(new_data != 0, AppError::DataNol);
        require!(new_data != ctx.accounts.akun_data_user.data, AppError::DataTidakBerubah);

        ctx.accounts.akun_data_user.data = new_data;

        msg!("Data berhasil diupdate ke {} pada index {}", new_data, index);
        Ok(())
    }

    pub fn delete_akun(ctx: Context<DeleteAkun>, index: u64) -> Result<()> {
        require!(index <= MAX_INDEX, AppError::IndexLebihDari99 );
        ctx.accounts.akun_user.total -= 1;

        msg!("Data berhasil dihapus pada index {}", index);
        Ok(())
    }
}