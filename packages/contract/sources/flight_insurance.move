module flight_delay_insurance::flight_insurance {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::event;
    use std::vector;

    /// Error codes
    const EINVALID_POLICY: u64 = 1;
    const EINVALID_AMOUNT: u64 = 2;
    const EINVALID_FLIGHT: u64 = 3;
    const EINVALID_STATUS: u64 = 4;
    const EPOLICY_NOT_FOUND: u64 = 5;
    const EINSUFFICIENT_FUNDS: u64 = 6;

    /// Constants
    const MINIMUM_PREMIUM: u64 = 10_000_000; // 0.01 SUI
    const MAXIMUM_PAYOUT: u64 = 100_000_000_000; // 100 SUI
    const MAX_DELAY_THRESHOLD: u64 = 1440; // 24 hours in minutes

    /// Insurance policy object
    public struct Policy has key, store {
        id: UID,
        owner: address,
        flight_number: vector<u8>,
        airline: vector<u8>,
        departure_time: u64,
        coverage_amount: u64,
        premium: u64,
        status: vector<u8>,
        created_at: u64
    }

    /// Insurance pool that holds premiums and pays out claims
    public struct InsurancePool has key {
        id: UID,
        balance: Balance<SUI>,
        policies: Table<ID, Policy>,
        policy_ids: vector<ID>
    }

    /// Event emitted when a new policy is created
    public struct PolicyCreated has copy, drop {
        policy_id: ID,
        owner: address,
        flight_number: vector<u8>,
        airline: vector<u8>,
        coverage_amount: u64,
        premium: u64,
        created_at: u64
    }

    /// Event emitted when a claim is processed
    public struct ClaimProcessed has copy, drop {
        policy_id: ID,
        owner: address,
        amount: u64,
        status: vector<u8>,
        processed_at: u64
    }

    /// Initialize the insurance pool
    fun init(ctx: &mut TxContext) {
        let pool = InsurancePool {
            id: object::new(ctx),
            balance: balance::zero<SUI>(),
            policies: table::new(ctx),
            policy_ids: vector::empty<ID>()
        };
        transfer::share_object(pool);
    }

    /// Create a new insurance policy
    public entry fun create_policy(
        pool: &mut InsurancePool,
        flight_number: vector<u8>,
        airline: vector<u8>,
        departure_time: u64,
        coverage_amount: u64,
        premium: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(coverage_amount > 0, EINVALID_AMOUNT);
        assert!(coverage_amount <= MAXIMUM_PAYOUT, EINVALID_AMOUNT);
        let premium_value = coin::value(&premium);
        assert!(premium_value >= MINIMUM_PREMIUM, EINVALID_AMOUNT);

        // Create policy
        let policy = Policy {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            flight_number,
            airline,
            departure_time,
            coverage_amount,
            premium: premium_value,
            status: b"ACTIVE",
            created_at: tx_context::epoch(ctx)
        };
        let policy_id = object::id(&policy);

        // Add policy to pool
        table::add(&mut pool.policies, policy_id, policy);
        vector::push_back(&mut pool.policy_ids, policy_id);

        // Add premium to pool balance
        balance::join(&mut pool.balance, coin::into_balance(premium));

        // Emit event
        event::emit(PolicyCreated {
            policy_id,
            owner: tx_context::sender(ctx),
            flight_number,
            airline,
            coverage_amount,
            premium: premium_value,
            created_at: tx_context::epoch(ctx)
        });
    }

    /// Get policy details
    public fun get_policy_details(policy: &Policy): (address, vector<u8>, vector<u8>, u64, u64, u64, vector<u8>, u64) {
        (
            policy.owner,
            policy.flight_number,
            policy.airline,
            policy.departure_time,
            policy.coverage_amount,
            policy.premium,
            policy.status,
            policy.created_at
        )
    }

    /// Process a claim for a delayed flight
    public entry fun process_claim(
        pool: &mut InsurancePool,
        policy_id: ID,
        delay_minutes: u64,
        ctx: &mut TxContext
    ) {
        // Get policy
        let policy = table::borrow_mut(&mut pool.policies, policy_id);
        assert!(policy.owner == tx_context::sender(ctx), EINVALID_POLICY);
        assert!(policy.status == b"ACTIVE", EINVALID_STATUS);

        // Check if delay exceeds threshold
        if (delay_minutes >= MAX_DELAY_THRESHOLD) {
            // Calculate payout
            let payout_amount = policy.coverage_amount;
            assert!(balance::value(&pool.balance) >= payout_amount, EINSUFFICIENT_FUNDS);

            // Update policy status
            policy.status = b"CLAIMED";

            // Create payout coin
            let payout = coin::from_balance(balance::split(&mut pool.balance, payout_amount), ctx);

            // Transfer payout to policy owner
            transfer::public_transfer(payout, policy.owner);

            // Emit event
            event::emit(ClaimProcessed {
                policy_id,
                owner: policy.owner,
                amount: payout_amount,
                status: b"APPROVED",
                processed_at: tx_context::epoch(ctx)
            });
        } else {
            // Update policy status
            policy.status = b"REJECTED";

            // Emit event
            event::emit(ClaimProcessed {
                policy_id,
                owner: policy.owner,
                amount: 0,
                status: b"REJECTED",
                processed_at: tx_context::epoch(ctx)
            });
        };
    }

    /// Get all policies for an address
    public fun get_policies(pool: &InsurancePool, owner: address): vector<ID> {
        let mut result_ids = vector::empty<ID>();
        let len = vector::length(&pool.policy_ids);
        let mut i = 0u64;
        while (i < len) {
            let key = *vector::borrow(&pool.policy_ids, i);
            let policy = table::borrow(&pool.policies, key);
            if (policy.owner == owner) {
                vector::push_back(&mut result_ids, key);
            };
            i = i + 1;
        };
        result_ids
    }
} 