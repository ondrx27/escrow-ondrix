const {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
} = require('@solana/spl-token');
const {
    findGlobalEscrowPDA,
    createInitializeEscrowInstruction,
} = require('./dist/tests/utils.js');

// NEW Program ID with transparency functions
const PROGRAM_ID = new PublicKey('9kaoCE6mLVUvvAkSkE4UbPkwb6fy7yfuDq78zGsRUVoS');

console.log(`🚀 Initializing Solana Escrow Contract: ${PROGRAM_ID.toString()}`);

// Connection to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const INVESTOR1_PRIVATE = 'your_base58_private_key_here';
const RECIPIENT_PUBLIC = 'EJ6bPvsTXfzk1WS9eXKDQ3KL5x9a2wy15XPxL48FdeAc'; 

// Base58 decoder
function decodeBase58(encoded) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const BASE = 58;
    
    let num = 0n;
    for (let i = 0; i < encoded.length; i++) {
        const char = encoded[i];
        const index = ALPHABET.indexOf(char);
        if (index === -1) throw new Error('Invalid character in base58 string');
        num = num * BigInt(BASE) + BigInt(index);
    }
    
    let hex = num.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    
    return new Uint8Array(bytes);
}

// Use existing test wallets 
const initializer = Keypair.fromSecretKey(decodeBase58(INVESTOR1_PRIVATE));
const recipient = new PublicKey(RECIPIENT_PUBLIC);

// Test constants matching EVM version
const TOKEN_DECIMALS = 9;
const TOKEN_SUPPLY = 1000; // 1000 tokens
const LOCK_DURATION = 14400; // 4 hours (14400 seconds)

async function createToken() {
    console.log('\n🏗️  Creating test token...');
    
    // Check existing SOL balance
    const balance = await connection.getBalance(initializer.publicKey);
    console.log(`💰 Initializer SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    // Create token mint using SPL function
    const tokenMintPubkey = await createMint(
        connection,
        initializer,
        initializer.publicKey,
        null,
        TOKEN_DECIMALS
    );
    
    console.log(`✅ Token mint created: ${tokenMintPubkey.toString()}`);
    console.log(`   - Decimals: ${TOKEN_DECIMALS}`);
    console.log(`   - Mint authority: ${initializer.publicKey.toString()}`);
    
    // Create token account for initializer and mint tokens
    const initializerTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        initializer,
        tokenMintPubkey,
        initializer.publicKey
    );
    
    // Mint tokens to initializer
    const tokenSupply = BigInt(TOKEN_SUPPLY * Math.pow(10, TOKEN_DECIMALS));
    await mintTo(
        connection,
        initializer,
        tokenMintPubkey,
        initializerTokenAccount.address,
        initializer,
        tokenSupply
    );
    
    console.log(`✅ Minted ${TOKEN_SUPPLY} tokens to initializer`);
    
    return {
        tokenMint: tokenMintPubkey,
        initializerTokenAccount: initializerTokenAccount.address,
    };
}

async function initializeEscrow(tokenMintPubkey, initializerTokenAccount) {
    console.log('\n🔧 Initializing escrow contract...');
    
    // Find Global Escrow PDA
    const [globalEscrow] = findGlobalEscrowPDA(initializer.publicKey, tokenMintPubkey, PROGRAM_ID);
    console.log(`📍 Global Escrow PDA: ${globalEscrow.toString()}`);
    
    // Use the token amount we minted (1000 tokens with 9 decimals)
    const tokenAmountForEscrow = BigInt(TOKEN_SUPPLY * Math.pow(10, TOKEN_DECIMALS));
    const lockDurationBigInt = BigInt(LOCK_DURATION);
    
    console.log(`🔧 Token amount for escrow: ${tokenAmountForEscrow.toString()}`);
    console.log(`⏰ Lock duration: ${LOCK_DURATION} seconds`);
    
    // Create initialize instruction using utils function
    const initializeInstruction = await createInitializeEscrowInstruction(
        initializer.publicKey,
        tokenMintPubkey,
        initializerTokenAccount,
        recipient,
        tokenAmountForEscrow,
        lockDurationBigInt,
        PROGRAM_ID
    );
    
    // Send initialize transaction
    const initializeTx = new Transaction().add(initializeInstruction);
    
    try {
        const signature = await sendAndConfirmTransaction(connection, initializeTx, [initializer]);
        console.log(`✅ Escrow initialized successfully!`);
        console.log(`   Transaction: ${signature}`);
        console.log(`   Lock duration: ${LOCK_DURATION} seconds`);
        
        return {
            globalEscrow: globalEscrow.toString(),
            tokenMint: tokenMintPubkey.toString(),
            recipient: recipient.toString(),
            signature,
        };
        
    } catch (error) {
        console.error('❌ Failed to initialize escrow:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('\n🎯 Starting Solana Escrow Initialization');
        console.log(`Program ID: ${PROGRAM_ID.toString()}`);
        console.log(`Initializer: ${initializer.publicKey.toString()}`);
        console.log(`Recipient: ${recipient.toString()}`);
        
        // Step 1: Create test token
        const { tokenMint, initializerTokenAccount } = await createToken();
        
        // Step 2: Initialize escrow
        const addresses = await initializeEscrow(tokenMint, initializerTokenAccount);
        
        console.log('\n🎉 Initialization Complete!');
        console.log('\n📋 Contract Addresses:');
        console.log(`Program ID: ${PROGRAM_ID.toString()}`);
        console.log(`Global Escrow: ${addresses.globalEscrow}`);
        console.log(`Token Mint: ${addresses.tokenMint}`);
        console.log(`Recipient: ${addresses.recipient}`);
        console.log(`Initializer: ${initializer.publicKey.toString()}`);
        console.log(`Transaction: https://explorer.solana.com/tx/${addresses.signature}?cluster=devnet`);
        
        console.log('\n💡 Use these addresses to update your frontend configuration!');
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

main();
