# Policy ID Mismatch Debug Guide

## Problem Description
When creating a policy and then trying to process a claim, you may encounter a "Policy not found" error because the policy ID stored in localStorage doesn't match the policy ID in the contract's pool.

## Root Cause
The issue occurs due to:
1. **Auto-cleanup interference**: The auto-cleanup function was running after policy creation, potentially removing valid policies
2. **Synchronization issues**: localStorage and contract state getting out of sync
3. **Table vs Vector inconsistencies**: The contract uses both a `Table<ID, Policy>` and a `vector<ID>` to store policies

## Solution Steps

### Step 1: Use the Debug Tool
1. Open the application and connect your wallet
2. Go to the **Debug** tab
3. Click the **🔍 Debug Policy ID Mismatch** button (red button at the top)
4. Check the console for detailed analysis
5. The tool will automatically fix localStorage by removing invalid policies

### Step 2: Manual Verification
If the debug tool doesn't solve the issue, use these additional debug buttons:

1. **Get Pool Info** - Shows all policy IDs in the contract
2. **Check Policy ID** - Verifies if a specific policy exists
3. **Verify in Pool** - Checks if a policy is in the correct pool
4. **Detailed Pool Analysis** - Comprehensive pool state analysis

### Step 3: Manual Fix (if needed)
If policies are still mismatched:

1. **Clear localStorage**: Use the "Clear localStorage" button in the debug section
2. **Recreate policies**: Create new policies after clearing localStorage
3. **Use contract policies**: Copy policy IDs directly from the contract instead of localStorage

## Prevention
The auto-cleanup that was causing this issue has been disabled after policy creation. This should prevent future mismatches.

## Debug Information
The debug tool provides:
- Total policies in localStorage vs contract
- List of policies missing in each location
- Automatic cleanup of invalid localStorage entries
- Detailed console logging for troubleshooting

## Common Error Messages
- "Policy not found" - Policy ID doesn't exist in contract
- "Object not found" - Policy object was deleted or corrupted
- "Invalid policy ID format" - Policy ID is malformed

## Quick Fix
If you're experiencing this issue right now:
1. Click **🔍 Debug Policy ID Mismatch**
2. Follow the console output
3. Try creating a new policy
4. Use the new policy ID for claims

This should resolve the policy ID mismatch issue and allow claims to be processed successfully. 