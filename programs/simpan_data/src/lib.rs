use anchor_lang::prelude::*;

declare_id!("DyK22yV8aBuyYSHw9kRnrR2UYBnVDasxczsLSQ2uVpEb");

pub const MAX_INDEX: u64 = 99;
pub const MAX_STRING_LENGTH: usize = 100;

#[error_code]
pub enum AppError {
    #[msg("Index out of bounds")]
    IndexOutOfBounds,

    #[msg("String exceeds maximum length")]
    StringTooLong,

    #[msg("Name is empty")]
    EmptyName,

    #[msg("Data is empty")]
    EmptyData,

    #[msg("Data is not changed")]
    DataNotChanged,

    #[msg("Amount must be greater than zero")]
    AmountZero,
}

#[account]
pub struct UserAccount {
    pub name: String,
    pub owner: Pubkey,
    pub total: u32
}

#[account]
pub struct UserData {
    pub owner: Pubkey,
    pub data: u64
}

#[event]
pub struct InitializeAccountEvent {
    pub name: String,
    pub owner: Pubkey,
}

#[event]
pub struct InitializeDataEvent {
    pub owner: Pubkey,
    pub data: u64,
    pub index: u64
}

#[event]
pub struct UpdateDataEvent {
    pub owner: Pubkey,
    pub old_data: u64,
    pub new_data: u64,
    pub index: u64
}

#[event]
pub struct DeleteDataEvent {
    pub owner: Pubkey,
    pub index: u64
}

#[event]
pub struct SolTransferredEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
pub struct InitializeAccount<'info> {
    #[account(
        init,
        seeds = [b"user-account", caller.key().as_ref()],
        bump,
        space = 8 + 32 + 4 + 4 + MAX_STRING_LENGTH,
        payer = caller
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct InitializeData<'info> {
    #[account(
        init,
        seeds = [b"user-data", caller.key().as_ref(), &index.to_le_bytes()],
        bump,
        space = 8 + 32 + 8,
        payer = caller
    )]
    pub user_data: Account<'info, UserData>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user-account", caller.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct UpdateData<'info> {
    #[account(
        mut,
        seeds = [b"user-data", caller.key().as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub user_data: Account<'info, UserData>,

    #[account(mut)]
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferSol<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    /// CHECK: recipient is just a wallet address, no data validation needed
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct DeleteData<'info> {
    #[account(
        mut,
        seeds = [b"user-data", caller.key().as_ref(), &index.to_le_bytes()],
        bump,
        close = caller
    )]
    pub user_data: Account<'info, UserData>,

    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user-account", caller.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
}

#[program]
pub mod simpan_data {
    use super::*;
    pub fn initialize_account(ctx: Context<InitializeAccount>, name: String) -> Result<()> {
        require!(name.len() <= MAX_STRING_LENGTH, AppError::StringTooLong);
        require!(!name.is_empty(), AppError::EmptyName);

        let user_account = &mut ctx.accounts.user_account;
        user_account.name = name.clone();
        user_account.owner = ctx.accounts.caller.key();
        user_account.total = 0;

        emit!(InitializeAccountEvent{
            name: name,
            owner: ctx.accounts.caller.key(),
        });

        msg!("Account initialized successfully for {}", user_account.name);
        Ok(())
    }

    pub fn initialize_data(ctx: Context<InitializeData>, index: u64, data: u64) -> Result<()> {
        require!(index <= MAX_INDEX, AppError::IndexOutOfBounds);
        require!(data != 0, AppError::EmptyData);

        let user_data = &mut ctx.accounts.user_data;
        user_data.owner = ctx.accounts.caller.key();
        user_data.data = data.clone();

        let user_account = &mut ctx.accounts.user_account;
        user_account.total += 1;

        emit!(
            InitializeDataEvent {
                owner: ctx.accounts.caller.key(),
                data: data,
                index: index
            }
        );

        msg!("Data initialized successfully at index {} with value {}", index, data);
        Ok(())
    }

    pub fn update_data(ctx: Context<UpdateData>, index: u64, new_data: u64) -> Result<()> {
        require!(index <= MAX_INDEX, AppError::IndexOutOfBounds);
        require!(new_data != 0, AppError::EmptyData);
        require!(ctx.accounts.user_data.data != new_data, AppError::DataNotChanged);

        let user_data = &mut ctx.accounts.user_data;
        let old_data = user_data.data;
        user_data.data = new_data.clone();

        emit!(
            UpdateDataEvent {
                owner: ctx.accounts.caller.key(),
                old_data: old_data,
                new_data: new_data,
                index: index
            }
        );

        msg!("Data at index {} updated successfully from {} to {}", index, old_data, new_data);
        Ok(())
    }

    pub fn transfer_sol(ctx: Context<TransferSol>, amount: u64) -> Result<()> {
        require!(amount > 0, AppError::AmountZero);

        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.caller.key(),
                &ctx.accounts.recipient.key(),
                amount,
            ),
            &[
                ctx.accounts.caller.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
            ],
        )?;

        emit!(SolTransferredEvent {
            from: ctx.accounts.caller.key(),
            to: ctx.accounts.recipient.key(),
            amount,
        });

        msg!("Transferred {} lamports from {} to {}", amount, ctx.accounts.caller.key(), ctx.accounts.recipient.key());
        Ok(())
    }

    pub fn delete_data(ctx: Context<DeleteData>, index: u64) -> Result<()> {
        require!(index <= MAX_INDEX, AppError::IndexOutOfBounds);

        let user_account = &mut ctx.accounts.user_account;
        user_account.total -= 1;

        emit!(
            DeleteDataEvent {
                owner: ctx.accounts.caller.key(),
                index: index
            }
        );

        msg!("Data at index {} deleted successfully", index);
        Ok(())
    }
}