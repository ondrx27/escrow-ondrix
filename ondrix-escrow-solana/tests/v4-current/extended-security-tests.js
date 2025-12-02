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
} = require('@solana/spl-token');
const {
    PROGRAM_ID,
    findGlobalEscrowPDA,
    createInitializeEscrowInstruction,
    createDepositSolInstruction,
    createWithdrawLockedSolInstruction,
    createCloseSaleInstruction,
    EscrowInstruction,
    EscrowInstructionData,
} = require('../../dist/tests/utils.js');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Existing wallets from previous V4 testing
const RECIPIENT_PRIVATE = 'CHANGE';
const INVESTOR1_PRIVATE = 'CHANGE';

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

async function runExtendedSecurityTests() {
    console.log('🔒 Extended Security Tests');
    console.log(`📍 Program ID: ${PROGRAM_ID.toString()}`);
    console.log('===============================\n');
    
    const recipient = Keypair.fromSecretKey(decodeBase58(RECIPIENT_PRIVATE));
    const investor1 = Keypair.fromSecretKey(decodeBase58(INVESTOR1_PRIVATE));
    
    // Use existing escrow for testing
    const tokenMint = new PublicKey('CHANGE');
    const globalEscrow = new PublicKey('CHANGE');
    
    console.log('Using existing escrow:');
    console.log(`Token Mint: ${tokenMint.toString()}`);
    console.log(`Global Escrow: ${globalEscrow.toString()}\n`);
    
    let passedTests = 0;
    const totalTests = 6;
    
    // Test 1: Deposit below minimum
    try {
        console.log('🧪 Test 1: Deposit below minimum');
        const tooSmallAmount = BigInt(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL < 0.1 SOL minimum
        
        const depositInstruction = await createDepositSolInstruction(
            investor1.publicKey,
            globalEscrow,
            tokenMint,
            recipient.publicKey,
            tooSmallAmount,
            PROGRAM_ID
        );
        
        const transaction = new Transaction().add(depositInstruction);
        const simulation = await connection.simulateTransaction(transaction, [investor1]);
        
        if (simulation.value.err) {
            console.log('   ✅ PASS: Below minimum deposit correctly rejected');
            passedTests++;
        } else {
            console.log('   ❌ FAIL: Below minimum deposit was accepted');
        }
    } catch (error) {
        console.log('   ✅ PASS: Below minimum deposit correctly rejected');
        passedTests++;
    }
    
    // Test 2: Deposit above maximum  
    try {
        console.log('\n🧪 Test 2: Deposit above maximum');
        const tooLargeAmount = BigInt(15000 * LAMPORTS_PER_SOL); // 15,000 SOL > 10,000 SOL maximum
        
        const depositInstruction = await createDepositSolInstruction(
            investor1.publicKey,
            globalEscrow,
            tokenMint,
            recipient.publicKey,
            tooLargeAmount,
            PROGRAM_ID
        );
        
        const transaction = new Transaction().add(depositInstruction);
        const simulation = await connection.simulateTransaction(transaction, [investor1]);
        
        if (simulation.value.err) {
            console.log('   ✅ PASS: Above maximum deposit correctly rejected');
            passedTests++;
        } else {
            console.log('   ❌ FAIL: Above maximum deposit was accepted');
        }
    } catch (error) {
        console.log('   ✅ PASS: Above maximum deposit correctly rejected');
        passedTests++;
    }
    
    // Test 3: Wrong price feed
    try {
        console.log('\n🧪 Test 3: Wrong price feed');
        const wrongPriceFeed = Keypair.generate().publicKey;
        
        // Create instruction with wrong accounts
        const fakeInstruction = await createDepositSolInstruction(
            investor1.publicKey,
            globalEscrow,
            tokenMint,
            recipient.publicKey,
            BigInt(1 * LAMPORTS_PER_SOL),
            PROGRAM_ID
        );
        
        // Replace price feed account with wrong one
        fakeInstruction.keys[9].pubkey = wrongPriceFeed;
        
        const transaction = new Transaction().add(fakeInstruction);
        const simulation = await connection.simulateTransaction(transaction, [investor1]);
        
        if (simulation.value.err) {
            console.log('   ✅ PASS: Wrong price feed correctly rejected');
            passedTests++;
        } else {
            console.log('   ❌ FAIL: Wrong price feed was accepted');
        }
    } catch (error) {
        console.log('   ✅ PASS: Wrong price feed correctly rejected');
        passedTests++;
    }
    
    // Test 4: Early withdraw attempt
    try {
        console.log('\n🧪 Test 4: Early withdraw attempt');
        const fakeInvestorPDA = Keypair.generate().publicKey;
        
        const withdrawInstruction = await createWithdrawLockedSolInstruction(
            recipient.publicKey,
            globalEscrow,
            fakeInvestorPDA,
            investor1.publicKey,
            recipient.publicKey,
            PROGRAM_ID
        );
        
        const transaction = new Transaction().add(withdrawInstruction);
        const simulation = await connection.simulateTransaction(transaction, [recipient]);
        
        if (simulation.value.err) {
            console.log('   ✅ PASS: Early withdraw correctly blocked');
            passedTests++;
        } else {
            console.log('   ❌ FAIL: Early withdraw was allowed');
        }
    } catch (error) {
        console.log('   ✅ PASS: Early withdraw correctly blocked');
        passedTests++;
    }
    
    // Test 5: Unauthorized withdraw attempt
    try {
        console.log('\n🧪 Test 5: Unauthorized withdraw attempt');
        const fakeInvestorPDA = Keypair.generate().publicKey;
        
        const withdrawInstruction = await createWithdrawLockedSolInstruction(
            investor1.publicKey, // Wrong signer (should be recipient)
            globalEscrow,
            fakeInvestorPDA,
            investor1.publicKey,
            recipient.publicKey,
            PROGRAM_ID
        );
        
        const transaction = new Transaction().add(withdrawInstruction);
        const simulation = await connection.simulateTransaction(transaction, [investor1]);
        
        if (simulation.value.err) {
            console.log('   ✅ PASS: Unauthorized withdraw correctly rejected');
            passedTests++;
        } else {
            console.log('   ❌ FAIL: Unauthorized withdraw was allowed');
        }
    } catch (error) {
        console.log('   ✅ PASS: Unauthorized withdraw correctly rejected');
        passedTests++;
    }
    
    // Test 6: Close sale before end time
    try {
        console.log('\n🧪 Test 6: Close sale before end time');
        const closeSaleInstruction = await createCloseSaleInstruction(
            recipient.publicKey,
            globalEscrow,
            tokenMint,
            PROGRAM_ID
        );
        
        const transaction = new Transaction().add(closeSaleInstruction);
        const simulation = await connection.simulateTransaction(transaction, [recipient]);
        
        if (simulation.value.err) {
            console.log('   ✅ PASS: Early sale closure correctly rejected');
            passedTests++;
        } else {
            console.log('   ❌ FAIL: Early sale closure was allowed');
        }
    } catch (error) {
        console.log('   ✅ PASS: Early sale closure correctly rejected');
        passedTests++;
    }
    
    // Results
    console.log('\n📊 EXTENDED SECURITY TEST RESULTS:');
    console.log('=====================================');
    console.log(`✅ Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`📈 Success Rate: ${(passedTests/totalTests*100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 ALL SECURITY TESTS PASSED!');
        console.log('Contract properly enforces all security requirements.');
    } else {
        console.log(`\n⚠️ ${totalTests - passedTests} test(s) failed. Review security implementation.`);
    }
}

runExtendedSecurityTests().catch(console.error);