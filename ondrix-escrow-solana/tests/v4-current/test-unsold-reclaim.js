const {
    Connection,
    PublicKey,
    Keypair,
    LAMPORTS_PER_SOL,
    Transaction,
    sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    getAccount,
} = require('@solana/spl-token');
const {
    PROGRAM_ID,
    findGlobalEscrowPDA,
    findTokenVaultPDA,
    createInitializeEscrowInstruction,
    createCloseSaleInstruction,
    EscrowInstruction,
    EscrowInstructionData,
} = require('../../dist/tests/utils.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

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

async function testUnsoldReclaim() {
    console.log('🔄 Testing Unsold Token Reclaim Functionality');
    console.log('==============================================\n');
    
    const RECIPIENT_PRIVATE = 'CHANGE';
    const recipient = Keypair.fromSecretKey(decodeBase58(RECIPIENT_PRIVATE));
    
    console.log('📋 Test Setup:');
    console.log(`Recipient: ${recipient.publicKey.toString()}`);
    
    try {
        // Create new token mint for test
        const tokenMint = await createMint(
            connection,
            recipient,
            recipient.publicKey,
            null,
            6
        );
        console.log(`Token Mint: ${tokenMint.toString()}`);
        
        // Create token account for recipient
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            recipient,
            tokenMint,
            recipient.publicKey
        );
        console.log(`Recipient Token Account: ${recipientTokenAccount.address.toString()}`);
        
        // Mint tokens for escrow
        const tokenAmount = BigInt(1000000 * 1000000); // 1M tokens
        await mintTo(
            connection,
            recipient,
            tokenMint,
            recipientTokenAccount.address,
            recipient.publicKey,
            Number(tokenAmount)
        );
        console.log(`✅ Minted ${tokenAmount / BigInt(1000000)} tokens to recipient`);
        
        // Initialize escrow with short sale period
        const lockDuration = BigInt(60);
        const saleEndTimestamp = Math.floor(Date.now() / 1000) + 2; // 2 seconds
        
        const [globalEscrowPDA] = findGlobalEscrowPDA(recipient.publicKey, tokenMint, PROGRAM_ID);
        console.log(`Global Escrow: ${globalEscrowPDA.toString()}`);
        
        const initializeInstruction = await createInitializeEscrowInstruction(
            recipient.publicKey,
            tokenMint,
            recipientTokenAccount.address,
            recipient.publicKey,
            tokenAmount,
            lockDuration,
            PROGRAM_ID
        );
        
        // Custom instruction data with short sale end time
        const customData = new EscrowInstructionData(EscrowInstruction.InitializeEscrow, {
            tokenAmount,
            lockDuration,
        });
        customData.saleEndTimestamp = saleEndTimestamp;
        customData.minSolInvestment = BigInt(0.1 * LAMPORTS_PER_SOL);
        customData.maxSolInvestment = BigInt(10 * LAMPORTS_PER_SOL);
        customData.priceStalenessThreshold = BigInt(300);
        
        initializeInstruction.data = customData.serialize();
        
        const initTransaction = new Transaction().add(initializeInstruction);
        
        console.log('\n🚀 Initializing escrow with 2-second sale period...');
        const initSignature = await sendAndConfirmTransaction(
            connection,
            initTransaction,
            [recipient],
            { commitment: 'confirmed' }
        );
        console.log(`✅ Escrow initialized: ${initSignature}`);
        
        // Wait for sale period to end
        console.log('\n⏳ Waiting for sale period to end (3 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check tokens in vault before reclaim
        const [tokenVaultPDA] = findTokenVaultPDA(globalEscrowPDA, PROGRAM_ID);
        const vaultAccountBefore = await getAccount(connection, tokenVaultPDA);
        console.log(`\n💰 Tokens in vault before reclaim: ${vaultAccountBefore.amount}`);
        
        // Reclaim unsold tokens
        console.log('\n🔄 Attempting to reclaim unsold tokens...');
        const reclaimInstruction = await createCloseSaleInstruction(
            recipient.publicKey,
            globalEscrowPDA,
            tokenMint,
            PROGRAM_ID
        );
        
        const reclaimTransaction = new Transaction().add(reclaimInstruction);
        
        const reclaimSignature = await sendAndConfirmTransaction(
            connection,
            reclaimTransaction,
            [recipient],
            { commitment: 'confirmed' }
        );
        console.log(`✅ Unsold tokens reclaimed: ${reclaimSignature}`);
        
        // Check results
        const recipientBalanceAfter = await getAccount(connection, recipientTokenAccount.address);
        console.log(`\n🎉 Recipient token balance after reclaim: ${recipientBalanceAfter.amount}`);
        
        try {
            const vaultAccountAfter = await getAccount(connection, tokenVaultPDA);
            console.log(`💰 Tokens remaining in vault: ${vaultAccountAfter.amount}`);
        } catch (e) {
            console.log('📝 Vault account closed (expected after full reclaim)');
        }
        
        console.log('\n✅ UNSOLD TOKEN RECLAIM TEST PASSED!');
        console.log('Contract properly allows recipient to reclaim unsold tokens after sale ends.');
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.logs) {
            console.log('📜 Logs:');
            error.logs.forEach(log => console.log(`   ${log}`));
        }
    }
}

testUnsoldReclaim().catch(console.error);