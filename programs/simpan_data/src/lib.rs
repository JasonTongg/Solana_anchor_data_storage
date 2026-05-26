use anchor_lang::prelude::*;

declare_id!("DLrc7vnZPLs3kbUGxFRSZ3LqcHzEzUWuCDjc9qzy6vVA");

pub const MAX_INDEX: u64 = 99;

#[error_code]
pub enum AppError {
    #[msg("Tidak boleh nol")]
    TidakBolehNol,

    #[msg("Indexnya lebih dari 99")]
    IndexLebihDari99,

    #[msg("Datanya tidak berubah")]
    DataTidakBerubah
}

#[account]
pub struct DataSaya {
    data: u64
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct BuatData<'info> {
    #[account(
        init,
        space = 16,
        payer = caller,
        seeds = [b"data", caller.key().as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub akun_data_saya: Account<'info, DataSaya>,

    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct UpdateData<'info> {
    #[account(
        mut,
        seeds = [b"data", caller.key().as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub akun_data_saya: Account<'info, DataSaya>,

    #[account(mut)]
    pub caller: Signer<'info>
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct DeleteData<'info> {
    #[account(
        mut,
        seeds = [b"data", caller.key().as_ref(), &index.to_le_bytes()],
        bump,
        close = caller
    )]
    pub akun_data_saya: Account<'info, DataSaya>,

    #[account(mut)]
    pub caller: Signer<'info>
}

#[program]
pub mod simpan_data {
    use super::*;
    pub fn buat_data(ctx: Context<BuatData>, index: u64, new_data: u64) -> Result<()> {
        require!(index < MAX_INDEX, AppError::IndexLebihDari99);
        require!(new_data != 0, AppError::TidakBolehNol);

        ctx.accounts.akun_data_saya.data = new_data;

        msg!("Data berhasil dibuat: {} di index ke{}", new_data, index);
        Ok(())
    }

    pub fn update_data(ctx: Context<UpdateData>, index: u64, new_data: u64) -> Result<()> {
        require!(index < MAX_INDEX, AppError::IndexLebihDari99);
        require!(new_data != 0, AppError::TidakBolehNol);
        require!(new_data != ctx.accounts.akun_data_saya.data, AppError::DataTidakBerubah);

        ctx.accounts.akun_data_saya.data = new_data;

        msg!("Data berhasil diubah: {} di index ke{}", new_data, index);
        Ok(())
    }

    pub fn delete_data(_ctx: Context<DeleteData>, index: u64) -> Result<()> {
        require!(index < MAX_INDEX, AppError::IndexLebihDari99);
        msg!("Data berhasil dihapus pada index ke{}", index);
        Ok(())
    }
}