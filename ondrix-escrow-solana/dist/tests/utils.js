"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowInstructionData = exports.EscrowInstruction = exports.PROGRAM_ID = void 0;
exports.findGlobalEscrowPDA = findGlobalEscrowPDA;
exports.findInvestorPDA = findInvestorPDA;
exports.findTokenVaultPDA = findTokenVaultPDA;
exports.findSolVaultPDA = findSolVaultPDA;
exports.findEscrowPDA = findEscrowPDA;
exports.createInitializeEscrowInstruction = createInitializeEscrowInstruction;
exports.createDepositSolInstruction = createDepositSolInstruction;
exports.createWithdrawLockedSolInstruction = createWithdrawLockedSolInstruction;
exports.createGetEscrowStatusInstruction = createGetEscrowStatusInstruction;
exports.createTokenMint = createTokenMint;
exports.fundAccount = fundAccount;
exports.sleep = sleep;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
exports.PROGRAM_ID = new web3_js_1.PublicKey('3gaZV6rGnQYKLcoB2hqy2C6AgvZrdh9ozLpD5XghL7sZ'); // V4 Secured deployment with withdraw fix
// PDA helper functions matching Rust implementation
function findGlobalEscrowPDA(initializer, tokenMint, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('global_escrow'), initializer.toBuffer(), tokenMint.toBuffer()], programId);
}
function findInvestorPDA(investor, globalEscrow, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('investor'), investor.toBuffer(), globalEscrow.toBuffer()], programId);
}
function findTokenVaultPDA(globalEscrow, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('token_vault'), globalEscrow.toBuffer()], programId);
}
function findSolVaultPDA(investor, globalEscrow, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sol_vault'), investor.toBuffer(), globalEscrow.toBuffer()], programId);
}
var EscrowInstruction;
(function (EscrowInstruction) {
    EscrowInstruction[EscrowInstruction["InitializeEscrow"] = 0] = "InitializeEscrow";
    EscrowInstruction[EscrowInstruction["DepositSol"] = 1] = "DepositSol";
    EscrowInstruction[EscrowInstruction["WithdrawLockedSol"] = 2] = "WithdrawLockedSol";
    EscrowInstruction[EscrowInstruction["GetEscrowStatus"] = 3] = "GetEscrowStatus";
})(EscrowInstruction || (exports.EscrowInstruction = EscrowInstruction = {}));
class EscrowInstructionData {
    constructor(instruction, params) {
        this.instruction = instruction;
        this.tokenAmount = params?.tokenAmount;
        this.lockDuration = params?.lockDuration;
        this.solAmount = params?.solAmount;
    }
    serialize() {
        const buffers = [];
        // Add instruction type
        buffers.push(Buffer.from([this.instruction]));
        if (this.instruction === EscrowInstruction.InitializeEscrow) {
            if (!this.tokenAmount || !this.lockDuration) {
                throw new Error('Token amount and lock duration required for InitializeEscrow');
            }
            // Add token amount (8 bytes, little endian)
            const tokenAmountBuffer = Buffer.alloc(8);
            tokenAmountBuffer.writeBigUInt64LE(this.tokenAmount);
            buffers.push(tokenAmountBuffer);
            // Add lock duration (8 bytes, little endian)  
            const lockDurationBuffer = Buffer.alloc(8);
            lockDurationBuffer.writeBigInt64LE(this.lockDuration);
            buffers.push(lockDurationBuffer);
        }
        if (this.instruction === EscrowInstruction.DepositSol) {
            if (!this.solAmount) {
                throw new Error('SOL amount required for DepositSol');
            }
            // Add SOL amount (8 bytes, little endian)
            const solAmountBuffer = Buffer.alloc(8);
            solAmountBuffer.writeBigUInt64LE(this.solAmount);
            buffers.push(solAmountBuffer);
        }
        return Buffer.concat(buffers);
    }
}
exports.EscrowInstructionData = EscrowInstructionData;
// Legacy function for backward compatibility
async function findEscrowPDA(investor, programId) {
    // This is now findInvestorPDA, but we need a globalEscrow address
    // For compatibility, we'll throw an error suggesting the new approach
    throw new Error('Use findInvestorPDA with globalEscrow address instead');
}
async function createInitializeEscrowInstruction(initializer, tokenMint, tokenSourceAccount, recipientWallet, tokenAmount, lockDuration, programId) {
    const [globalEscrowPDA] = findGlobalEscrowPDA(initializer, tokenMint, programId);
    const [tokenVaultPDA] = findTokenVaultPDA(globalEscrowPDA, programId);
    const data = new EscrowInstructionData(EscrowInstruction.InitializeEscrow, { tokenAmount, lockDuration });
    return new web3_js_1.TransactionInstruction({
        programId,
        keys: [
            { pubkey: initializer, isSigner: true, isWritable: true },
            { pubkey: globalEscrowPDA, isSigner: false, isWritable: true },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: tokenVaultPDA, isSigner: false, isWritable: true },
            { pubkey: tokenSourceAccount, isSigner: false, isWritable: true },
            { pubkey: recipientWallet, isSigner: false, isWritable: false },
            { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: data.serialize(),
    });
}
async function createDepositSolInstruction(investor, globalEscrowAccount, tokenMint, recipientWallet, solAmount, programId) {
    const [investorPDA] = findInvestorPDA(investor, globalEscrowAccount, programId);
    const [solVaultPDA] = findSolVaultPDA(investor, globalEscrowAccount, programId);
    const [tokenVaultPDA] = findTokenVaultPDA(globalEscrowAccount, programId);
    const investorTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, investor);
    // Chainlink SOL/USD feed addresses for Devnet (working addresses from your contract)
    const priceFeed = new web3_js_1.PublicKey([120, 245, 122, 225, 25, 94, 140, 73, 122, 139, 224, 84, 173, 82, 173, 244, 200, 151, 111, 132, 54, 115, 35, 9, 226, 42, 247, 6, 119, 36, 173, 150]);
    const oracleProgram = new web3_js_1.PublicKey([241, 75, 246, 90, 213, 107, 210, 186, 113, 94, 69, 116, 44, 35, 31, 39, 214, 54, 33, 207, 91, 119, 143, 55, 193, 162, 72, 149, 29, 23, 86, 2]);
    const data = new EscrowInstructionData(EscrowInstruction.DepositSol, { solAmount });
    return new web3_js_1.TransactionInstruction({
        programId,
        keys: [
            { pubkey: investor, isSigner: true, isWritable: true },
            { pubkey: globalEscrowAccount, isSigner: false, isWritable: true },
            { pubkey: investorPDA, isSigner: false, isWritable: true },
            { pubkey: solVaultPDA, isSigner: false, isWritable: true },
            { pubkey: tokenVaultPDA, isSigner: false, isWritable: true },
            { pubkey: investorTokenAccount, isSigner: false, isWritable: true },
            { pubkey: recipientWallet, isSigner: false, isWritable: true },
            { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: oracleProgram, isSigner: false, isWritable: false },
            { pubkey: priceFeed, isSigner: false, isWritable: false },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: new web3_js_1.PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
        ],
        data: data.serialize(),
    });
}
async function createWithdrawLockedSolInstruction(withdrawer, globalEscrowAccount, investorAccount, investor, // Need investor pubkey to find SOL vault
recipientWallet, // Recipient wallet that receives the locked SOL
programId) {
    const [solVaultPDA] = findSolVaultPDA(investor, globalEscrowAccount, programId);
    const data = new EscrowInstructionData(EscrowInstruction.WithdrawLockedSol);
    return new web3_js_1.TransactionInstruction({
        programId,
        keys: [
            { pubkey: withdrawer, isSigner: true, isWritable: true },
            { pubkey: globalEscrowAccount, isSigner: false, isWritable: true },
            { pubkey: investorAccount, isSigner: false, isWritable: true },
            { pubkey: solVaultPDA, isSigner: false, isWritable: true },
            { pubkey: recipientWallet, isSigner: false, isWritable: true },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: data.serialize(),
    });
}
async function createGetEscrowStatusInstruction(globalEscrowAccount, programId) {
    const data = new EscrowInstructionData(EscrowInstruction.GetEscrowStatus);
    return new web3_js_1.TransactionInstruction({
        programId,
        keys: [
            { pubkey: globalEscrowAccount, isSigner: false, isWritable: true },
            { pubkey: web3_js_1.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: data.serialize(),
    });
}
async function createTokenMint(connection, payer, mintAuthority, decimals = 6) {
    const mint = await (0, spl_token_1.createMint)(connection, payer, mintAuthority, null, decimals);
    return mint;
}
async function fundAccount(connection, payer, target, amount) {
    const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: target,
        lamports: amount,
    }));
    await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer]);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
