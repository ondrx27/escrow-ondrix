# Test Suite for Ondrix Escrow Contract

## 🧪 V4 Current Tests (Production Ready)

Located in `tests/v4-current/`:

### Core Tests
- **`full-cycle-test.js`** - Complete escrow lifecycle test
  - Initialize escrow with token mint
  - Multiple investor deposits
  - Time-locked withdrawals by recipient
  - Comprehensive flow validation

### Security Tests  
- **`extended-security-tests.js`** - Edge case security validation
  - ✅ Deposit below minimum (rejected)
  - ✅ Deposit above maximum (rejected) 
  - ✅ Wrong price feed (rejected)
  - ✅ Early withdraw attempt (blocked)
  - ✅ Unauthorized withdraw (rejected)
  - ✅ Premature sale closure (blocked)

### Feature Tests
- **`test-unsold-reclaim.js`** - Unsold token reclaim functionality
  - Create escrow with short sale period
  - Test recipient can reclaim unsold tokens after sale ends
  - Validates CloseSale instruction

## 🚀 Running Tests

```bash
# Run all V4 security tests
node tests/v4-current/extended-security-tests.js

# Run full lifecycle test  
node tests/v4-current/full-cycle-test.js

# Test unsold token reclaim
node tests/v4-current/test-unsold-reclaim.js
```

## 📊 Test Results

All tests pass with 100% success rate:
- ✅ Security tests: 6/6 passed
- ✅ Full cycle test: Complete lifecycle validated
- ✅ Unsold reclaim: Functionality confirmed

## 🔒 Security Validation

These tests validate all 7 client security requirements:
1. Recipient-only withdrawal policy
2. Oracle & feed immutability  
3. Config immutability
4. Strict ATA validation
5. Unsold token reclaim
6. Upgrade policy (program frozen)
7. Extended edge case testing

**Program ID:** `5UgjRxNo4qyh8Rvsw2p9LctGGDwXCxWFY6SK4bWhd9Gz`
