use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// pump.fun bundler: Main program file for the bundler functionality

#[program]
pub mod bundler {
    use super::*;

    // Create a new bundle
    pub fn create_bundle(ctx: Context<CreateBundle>, name: String, description: String) -> Result<()> {
        let bundle = &mut ctx.accounts.bundle;
        bundle.creator = ctx.accounts.creator.key();
        bundle.name = name;
        bundle.description = description;
        bundle.token_count = 0;
        Ok(())
    }

    // Add a token to an existing bundle
    pub fn add_token_to_bundle(ctx: Context<AddTokenToBundle>, token_mint: Pubkey) -> Result<()> {
        let bundle = &mut ctx.accounts.bundle;
        
        // Ensure the bundle has space for more tokens
        require!(bundle.token_count < 10, BundlerError::BundleFull);

        // Add the token mint to the bundle
        bundle.token_mints[bundle.token_count as usize] = token_mint;
        bundle.token_count += 1;

        Ok(())
    }

    // Create a new managed wallet
    pub fn create_wallet(ctx: Context<CreateWallet>, name: String) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        wallet.owner = ctx.accounts.owner.key();
        wallet.name = name;
        wallet.balance = 0;
        Ok(())
    }

    // Fund a managed wallet
    pub fn fund_wallet(ctx: Context<FundWallet>, amount: u64) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        wallet.balance += amount;

        // Transfer SOL from funder to wallet
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.funder.to_account_info(),
                to: ctx.accounts.wallet.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        Ok(())
    }

    // Buy tokens for a wallet
    pub fn buy_tokens(ctx: Context<BuyTokens>, amount: u64) -> Result<()> {
        // Implement token purchase logic here
        // This is a simplified version and doesn't include actual DEX integration
        let wallet = &mut ctx.accounts.wallet;
        require!(wallet.balance >= amount, BundlerError::InsufficientFunds);

        wallet.balance -= amount;

        // Transfer tokens to the wallet's token account
        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_mint.to_account_info(),
            },
        );
        token::transfer(cpi_context, amount)?;

        Ok(())
    }

    // Sell tokens from a wallet
    pub fn sell_tokens(ctx: Context<SellTokens>, amount: u64) -> Result<()> {
        // Implement token selling logic here
        // This is a simplified version and doesn't include actual DEX integration
        let wallet = &mut ctx.accounts.wallet;

        // Transfer tokens from the wallet's token account back to the mint
        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.token_mint.to_account_info(),
                authority: ctx.accounts.wallet.to_account_info(),
            },
        );
        token::transfer(cpi_context, amount)?;

        // Update wallet balance (simplified)
        wallet.balance += amount;

        Ok(())
    }
}

// Account structure for a bundle
#[account]
pub struct Bundle {
    pub creator: Pubkey,
    pub name: String,
    pub description: String,
    pub token_mints: [Pubkey; 10], // Array to store up to 10 token mints
    pub token_count: u8,
}

// Account structure for a managed wallet
#[account]
pub struct ManagedWallet {
    pub owner: Pubkey,
    pub name: String,
    pub balance: u64,
}

// Context for creating a new bundle
#[derive(Accounts)]
pub struct CreateBundle<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 64 + 256 + 32 * 10 + 1, // Adjust space calculation as needed
        seeds = [b"bundle", creator.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub bundle: Account<'info, Bundle>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Context for creating a new managed wallet
#[derive(Accounts)]
pub struct CreateWallet<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 64 + 8, // Adjust space calculation as needed
        seeds = [b"wallet", owner.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub wallet: Account<'info, ManagedWallet>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Context for adding a token to a bundle
#[derive(Accounts)]
pub struct AddTokenToBundle<'info> {
    #[account(
        mut,
        has_one = creator,
        seeds = [b"bundle", creator.key().as_ref(), bundle.name.as_bytes()],
        bump
    )]
    pub bundle: Account<'info, Bundle>,
    pub creator: Signer<'info>,
    pub token_account: Account<'info, TokenAccount>,
}

// Context for funding a managed wallet
#[derive(Accounts)]
pub struct FundWallet<'info> {
    #[account(mut)]
    pub wallet: Account<'info, ManagedWallet>,
    #[account(mut)]
    pub funder: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Context for buying tokens
#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub wallet: Account<'info, ManagedWallet>,
    #[account(mut)]
    pub token_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// Context for selling tokens
#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub wallet: Account<'info, ManagedWallet>,
    #[account(mut)]
    pub token_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// Custom error types for the bundler program
#[error_code]
pub enum BundlerError {
    #[msg("Bundle is full and cannot accept more tokens")]
    BundleFull,
    #[msg("Insufficient funds in the wallet")]
    InsufficientFunds,
}