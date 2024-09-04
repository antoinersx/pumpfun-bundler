import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Bundler } from "../target/types/bundler";
import { expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

// pump.fun Bundler: Test suite for the pump.fun Bundler program
describe("pump.fun Bundler", () => {
  // pump.fun Bundler: Set up the Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // pump.fun Bundler: Load the program
  const program = anchor.workspace.Bundler as Program<Bundler>;
  const developerWallet = Keypair.generate();
  const fundingWallet = Keypair.generate();
  let tokenMint: PublicKey;

  // pump.fun Bundler: Set up the test environment
  before(async () => {
    console.log("Setting up pump.fun Bundler test environment...");
    // Airdrop SOL to funding wallet
    await provider.connection.requestAirdrop(fundingWallet.publicKey, 10 * LAMPORTS_PER_SOL);

    // Create a test token for pump.fun Bundler
    tokenMint = await createMint(
      provider.connection,
      fundingWallet,
      fundingWallet.publicKey,
      null,
      9
    );
    console.log("pump.fun Bundler test token created:", tokenMint.toBase58());
  });

  // pump.fun Bundler: Test bundle creation
  it("Creates a pump.fun Bundler bundle", async () => {
    const bundleName = "pump.fun Test Bundle";
    const bundleDescription = "A test bundle for pump.fun Bundler";
    
    const [bundlePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("bundle"),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(bundleName),
      ],
      program.programId
    );

    await program.methods
      .createBundle(bundleName, bundleDescription)
      .accounts({
        bundle: bundlePda,
        creator: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const bundleAccount = await program.account.bundle.fetch(bundlePda);
    expect(bundleAccount.name).to.equal(bundleName);
    expect(bundleAccount.description).to.equal(bundleDescription);
    expect(bundleAccount.creator.toString()).to.equal(provider.wallet.publicKey.toString());
    expect(bundleAccount.tokenCount).to.equal(0);
    console.log("pump.fun Bundler bundle created:", bundlePda.toBase58());
  });

  // pump.fun Bundler: Test managed wallet creation
  it("Creates a pump.fun Bundler managed wallet", async () => {
    const walletName = "pump.fun Dev Wallet";
    const [walletPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("wallet"),
        developerWallet.publicKey.toBuffer(),
        Buffer.from(walletName),
      ],
      program.programId
    );

    await program.methods
      .createWallet(walletName)
      .accounts({
        wallet: walletPda,
        owner: developerWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([developerWallet])
      .rpc();

    const walletAccount = await program.account.managedWallet.fetch(walletPda);
    expect(walletAccount.name).to.equal(walletName);
    expect(walletAccount.owner.toString()).to.equal(developerWallet.publicKey.toString());
    expect(walletAccount.balance.toNumber()).to.equal(0);
    console.log("pump.fun Bundler managed wallet created:", walletPda.toBase58());
  });

  // pump.fun Bundler: Test wallet funding
  it("Funds a pump.fun Bundler managed wallet", async () => {
    const walletName = "pump.fun Dev Wallet";
    const [walletPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("wallet"),
        developerWallet.publicKey.toBuffer(),
        Buffer.from(walletName),
      ],
      program.programId
    );

    const fundAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    await program.methods
      .fundWallet(fundAmount)
      .accounts({
        wallet: walletPda,
        funder: fundingWallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([fundingWallet])
      .rpc();

    const walletAccount = await program.account.managedWallet.fetch(walletPda);
    expect(walletAccount.balance.toNumber()).to.equal(fundAmount.toNumber());
    console.log("pump.fun Bundler wallet funded with:", fundAmount.toString());
  });

  // pump.fun Bundler: Test token buying
  it("Buys tokens for a pump.fun Bundler managed wallet", async () => {
    const walletName = "pump.fun Dev Wallet";
    const [walletPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("wallet"),
        developerWallet.publicKey.toBuffer(),
        Buffer.from(walletName),
      ],
      program.programId
    );

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      developerWallet,
      tokenMint,
      developerWallet.publicKey
    );

    const buyAmount = new anchor.BN(1000000000); // 1 token

    await program.methods
      .buyTokens(buyAmount)
      .accounts({
        wallet: walletPda,
        tokenMint: tokenMint,
        tokenAccount: tokenAccount.address,
        tokenProgram: anchor.spl.TOKEN_PROGRAM_ID,
      })
      .signers([developerWallet])
      .rpc();

    const tokenAccountInfo = await provider.connection.getTokenAccountBalance(tokenAccount.address);
    expect(tokenAccountInfo.value.uiAmount).to.equal(1);
    console.log("pump.fun Bundler tokens bought:", buyAmount.toString());
  });

  // pump.fun Bundler: Test token selling
  it("Sells tokens from a pump.fun Bundler managed wallet", async () => {
    const walletName = "pump.fun Dev Wallet";
    const [walletPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("wallet"),
        developerWallet.publicKey.toBuffer(),
        Buffer.from(walletName),
      ],
      program.programId
    );

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      developerWallet,
      tokenMint,
      developerWallet.publicKey
    );

    const sellAmount = new anchor.BN(500000000); // 0.5 token

    await program.methods
      .sellTokens(sellAmount)
      .accounts({
        wallet: walletPda,
        tokenMint: tokenMint,
        tokenAccount: tokenAccount.address,
        tokenProgram: anchor.spl.TOKEN_PROGRAM_ID,
      })
      .signers([developerWallet])
      .rpc();

    const tokenAccountInfo = await provider.connection.getTokenAccountBalance(tokenAccount.address);
    expect(tokenAccountInfo.value.uiAmount).to.equal(0.5);
    console.log("pump.fun Bundler tokens sold:", sellAmount.toString());
  });

  // Add more pump.fun Bundler tests as needed
});