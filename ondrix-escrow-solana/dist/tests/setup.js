"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTestEnvironment = setupTestEnvironment;
exports.requestAirdrop = requestAirdrop;
const web3_js_1 = require("@solana/web3.js");
async function setupTestEnvironment() {
    const connection = new web3_js_1.Connection('http://localhost:8899', 'confirmed');
    // Check if local validator is running
    try {
        await connection.getVersion();
        console.log('✅ Connected to local Solana validator');
    }
    catch (error) {
        console.error('❌ Failed to connect to local validator. Make sure to run:');
        console.error('   solana-test-validator');
        process.exit(1);
    }
    return connection;
}
async function requestAirdrop(connection, pubkey, amount) {
    try {
        const signature = await connection.requestAirdrop(pubkey, amount * web3_js_1.LAMPORTS_PER_SOL);
        await connection.confirmTransaction(signature);
        console.log(`✅ Airdropped ${amount} SOL to ${pubkey.toString()}`);
    }
    catch (error) {
        console.error(`❌ Airdrop failed: ${error}`);
        throw error;
    }
}
// Check environment setup
async function checkEnvironment() {
    console.log('🔍 Checking test environment...');
    const connection = await setupTestEnvironment();
    // Create a test keypair and request airdrop to verify functionality
    const testKeypair = web3_js_1.Keypair.generate();
    await requestAirdrop(connection, testKeypair.publicKey, 1);
    const balance = await connection.getBalance(testKeypair.publicKey);
    if (balance > 0) {
        console.log('✅ Test environment is ready!');
        console.log(`   Test account balance: ${balance / web3_js_1.LAMPORTS_PER_SOL} SOL`);
    }
    else {
        throw new Error('Failed to fund test account');
    }
}
// Run environment check if called directly
if (require.main === module) {
    checkEnvironment().catch(console.error);
}
