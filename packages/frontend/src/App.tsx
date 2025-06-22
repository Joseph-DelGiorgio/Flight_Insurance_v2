import React, { useState, useEffect } from 'react'
import { ConnectButton, useWalletKit } from '@mysten/wallet-kit'
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import { Plane, Shield, Clock, DollarSign, FileText, Search, MapPin, Calendar, Users, TrendingUp, CheckCircle, XCircle, Bug } from 'lucide-react'

// Initialize Sui client for testnet
const client = new SuiClient({ url: getFullnodeUrl('testnet') })

// Contract configuration - using environment variables
const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x55733a72c40c01329a22c0f4116ec47565cd84fcdfc5399b0c68d52a32c5f5ce'
const INSURANCE_POOL_ID = import.meta.env.VITE_INSURANCE_POOL_ID || '0x959a9aabe6920b3241a9d4300edea4009d6cd2766969e3fb27b045f94f27c808'
const MODULE_NAME = 'flight_insurance'

// AviationStack API configuration - using environment variables
const AVIATION_API_KEY = import.meta.env.VITE_AVIATION_API_KEY || '261ac5a9daedd362068600f703640a86'
const AVIATION_API_URL = import.meta.env.VITE_AVIATION_API_URL || 'http://api.aviationstack.com/v1'

interface FlightData {
  flight: {
    number: string
    iata: string
  }
  departure: {
    airport: string
    iata: string
    scheduled: string
    estimated: string
    actual: string
    delay: number
  }
  arrival: {
    airport: string
    iata: string
    scheduled: string
    estimated: string
    actual: string
    delay: number
  }
  airline: {
    name: string
    iata: string
  }
  status: string
}

function App() {
  const { currentAccount, signTransactionBlock } = useWalletKit()
  const [flightNumber, setFlightNumber] = useState('')
  const [airline, setAirline] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [coverageAmount, setCoverageAmount] = useState('')
  const [premium, setPremium] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [delayMinutes, setDelayMinutes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [searchFlight, setSearchFlight] = useState('')
  const [flightData, setFlightData] = useState<FlightData | null>(null)
  const [searchingFlight, setSearchingFlight] = useState(false)
  const [activeTab, setActiveTab] = useState('create')
  const [showFlightSuggestions, setShowFlightSuggestions] = useState(false)
  const [showAirlineSuggestions, setShowAirlineSuggestions] = useState(false)
  const [userPolicies, setUserPolicies] = useState<Array<{
    policyId: string
    flightNumber: string
    airline: string
    departureTime: string
    coverageAmount: string
    premium: string
    status: 'active' | 'claimed' | 'expired'
    createdAt: string
  }>>([])
  const [contractPolicyIds, setContractPolicyIds] = useState<string[]>([])
  const [fundAmount, setFundAmount] = useState('')
  const [poolBalance, setPoolBalance] = useState<number | null>(null)

  // Load user policies from localStorage on component mount
  useEffect(() => {
    const savedPolicies = localStorage.getItem('userPolicies')
    if (savedPolicies) {
      const parsed = JSON.parse(savedPolicies)
      // Handle both old format (array of strings) and new format (array of objects)
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          // Old format: convert string IDs to policy objects
          const convertedPolicies = parsed.map((policyId: string) => ({
            policyId: policyId,
            flightNumber: 'Unknown',
            airline: 'Unknown',
            departureTime: 'Unknown',
            coverageAmount: 'Unknown',
            premium: 'Unknown',
            status: 'active' as const,
            createdAt: new Date().toISOString()
          }))
          setUserPolicies(convertedPolicies)
        } else {
          // New format: already objects
          setUserPolicies(parsed)
        }
      }
    }
    
    // Auto-sync with contract policies
    const syncWithContract = async () => {
      try {
        const result = await client.getObject({
          id: INSURANCE_POOL_ID,
          options: { showContent: true }
        });
        
        if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
          const fields = (result.data.content as any).fields;
          if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
            const contractPolicyIds = fields.policy_ids;
            setContractPolicyIds(contractPolicyIds);
            
            // Check if any contract policies are missing from localStorage
            const localPolicies = JSON.parse(localStorage.getItem('userPolicies') || '[]');
            const localIds = localPolicies.map((p: any) => p.policyId);
            
            const missingPolicies = contractPolicyIds.filter(id => !localIds.includes(id));
            
            if (missingPolicies.length > 0) {
              console.log('Found policies in contract but not in localStorage:', missingPolicies);
              // Add missing policies to localStorage with placeholder data
              const updatedPolicies = [...localPolicies];
              for (const policyId of missingPolicies) {
                const exists = await checkPolicyExists(policyId);
                if (exists) {
                  updatedPolicies.push({
                    policyId: policyId,
                    flightNumber: 'Unknown',
                    airline: 'Unknown',
                    departureTime: 'Unknown',
                    coverageAmount: 'Unknown',
                    premium: 'Unknown',
                    status: 'active' as const,
                    createdAt: new Date().toISOString()
                  });
                }
              }
              
              if (updatedPolicies.length !== localPolicies.length) {
                localStorage.setItem('userPolicies', JSON.stringify(updatedPolicies));
                setUserPolicies(updatedPolicies);
                console.log('Auto-synced localStorage with contract policies');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error syncing with contract:', error);
      }
    };
    
    // Run sync after a short delay to ensure wallet is connected
    const syncTimer = setTimeout(syncWithContract, 1000);
    return () => clearTimeout(syncTimer);
  }, [])

  // Helper functions for autocomplete
  const getFlightSuggestions = (query: string) => {
    const suggestions = [
      { flight: 'AA123', airline: 'American Airlines', route: 'JFK-LAX', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      { flight: 'AA456', airline: 'American Airlines', route: 'LAX-SFO', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      { flight: 'DL789', airline: 'Delta', route: 'ATL-LAX', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      { flight: 'UA101', airline: 'United', route: 'ORD-LAX', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      { flight: 'SW202', airline: 'Southwest', route: 'DAL-LAX', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      { flight: 'B6233', airline: 'JetBlue', route: 'JFK-SFO', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      { flight: 'AS456', airline: 'Alaska', route: 'SEA-LAX', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
    ]
    
    return suggestions.filter(suggestion => 
      suggestion.flight.toLowerCase().includes(query.toLowerCase()) ||
      suggestion.airline.toLowerCase().includes(query.toLowerCase()) ||
      suggestion.route.toLowerCase().includes(query.toLowerCase())
    )
  }

  const getAirlineSuggestions = (query: string) => {
    const airlines = [
      'American Airlines',
      'Delta Air Lines',
      'United Airlines',
      'Southwest Airlines',
      'JetBlue Airways',
      'Alaska Airlines',
      'Spirit Airlines',
      'Frontier Airlines',
      'Hawaiian Airlines',
      'Allegiant Air'
    ]
    
    return airlines.filter(airline => 
      airline.toLowerCase().includes(query.toLowerCase())
    )
  }

  const getPopularRoute = (from: string, to: string) => {
    const routes = {
      'JFK-LAX': { flight: 'AA123', airline: 'American Airlines', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      'LAX-SFO': { flight: 'AA456', airline: 'American Airlines', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      'ORD-LAX': { flight: 'UA101', airline: 'United', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      'ATL-LAX': { flight: 'DL789', airline: 'Delta', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      'JFK-SFO': { flight: 'B6233', airline: 'JetBlue', departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
    }
    
    const routeKey = `${from.toUpperCase()}-${to.toUpperCase()}`
    return routes[routeKey as keyof typeof routes]
  }

  // Search for real flight data
  const searchFlightData = async () => {
    if (!searchFlight.trim()) return
    
    setSearchingFlight(true)
    try {
      // Note: AviationStack free plan has CORS restrictions
      // In production, you'd need a backend proxy or upgrade to paid plan
      const response = await fetch(`${AVIATION_API_URL}/flights?access_key=${AVIATION_API_KEY}&flight_iata=${searchFlight}`)
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        const flight = data.data[0]
        setFlightData(flight)
        
        // Auto-fill form with real flight data
        setFlightNumber(flight.flight.number)
        setAirline(flight.airline.name)
        
        // Convert flight time to local datetime
        const departureTime = new Date(flight.departure.scheduled)
        const localTime = departureTime.toISOString().slice(0, 16)
        setDepartureTime(localTime)
        
        setMessage(`Found flight ${flight.flight.number} by ${flight.airline.name}`)
      } else {
        setMessage('Flight not found. Please check the flight number.')
      }
    } catch (error) {
      console.error('Error fetching flight data:', error)
      
      // Provide helpful error message for CORS issues
      if (error instanceof Error && error.message.includes('CORS')) {
        setMessage('Flight data API is not accessible due to CORS restrictions. Please enter flight details manually.')
      } else {
        setMessage('Error fetching flight data. Please enter flight details manually.')
      }
      
      // Clear any existing flight data
      setFlightData(null)
    } finally {
      setSearchingFlight(false)
    }
  }

  const createPolicy = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    if (!flightNumber || !airline || !departureTime || !coverageAmount || !premium) {
      setMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setMessage('Creating policy...');

    try {
      // Debug pool state before creation
      console.log('=== POOL STATE BEFORE POLICY CREATION ===');
      const poolBefore = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      console.log('Pool object before:', poolBefore);
      
      const tx = new TransactionBlock();
      
      // Convert amounts to MIST
      const coverageMist = Math.floor(parseFloat(coverageAmount) * 1000000000);
      const premiumMist = Math.floor(parseFloat(premium) * 1000000000);
      
      // Split coins for premium
      const [premiumCoin] = tx.splitCoins(tx.gas, [premiumMist]);
      
      // Convert strings to byte arrays
      const flightNumberBytes = Array.from(new TextEncoder().encode(flightNumber));
      const airlineBytes = Array.from(new TextEncoder().encode(airline));
      
      const policyData = {
        flightNumber: flightNumberBytes,
        airline: airlineBytes,
        departureTime: Math.floor(new Date(departureTime).getTime() / 1000),
        coverageAmount: coverageMist,
        premium: premiumMist,
        poolId: INSURANCE_POOL_ID
      };
      
      console.log('Creating policy with:', policyData);
      
      // Create policy
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::create_policy`,
        arguments: [
          tx.object(INSURANCE_POOL_ID),
          tx.pure(flightNumberBytes),
          tx.pure(airlineBytes),
          tx.pure(policyData.departureTime),
          tx.pure(coverageMist),
          premiumCoin,
        ],
      });

      // Sign the transaction
      const signedTx = await signTransactionBlock({ transactionBlock: tx as any });
      
      // Execute the transaction
      const result = await client.executeTransactionBlock({
        transactionBlock: signedTx.transactionBlockBytes,
        signature: signedTx.signature,
        options: { showEffects: true, showObjectChanges: true }
      });

      console.log('Create policy result:', result);
      
      // Debug pool state after creation
      console.log('=== POOL STATE AFTER POLICY CREATION ===');
      const poolAfter = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      console.log('Pool object after:', poolAfter);
      
      if (result.effects?.status?.status === 'success') {
        // Get the created policy ID from object changes
        const objectChanges = result.objectChanges || [];
        const createdPolicy = objectChanges.find(change => 
          change.type === 'created' && 
          'objectType' in change && 
          change.objectType && 
          change.objectType.includes('flight_insurance::Policy')
        ) as any;
        
        if (createdPolicy && createdPolicy.objectId) {
          const policyId = createdPolicy.objectId;
          console.log('✅ Policy created successfully with ID:', policyId);
          
          // Verify the policy exists in the contract before adding to localStorage
          const policyExists = await checkPolicyExists(policyId);
          if (!policyExists) {
            console.warn('⚠️ Policy created but not found in contract, waiting for sync...');
            // Wait a moment for the transaction to fully propagate
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryExists = await checkPolicyExists(policyId);
            if (!retryExists) {
              setMessage('❌ Policy created but could not be verified in contract. Please try again.');
              return;
            }
          }
          
          // Add to localStorage with full policy details
          const userPolicies = JSON.parse(localStorage.getItem('userPolicies') || '[]');
          const newPolicy = {
            policyId: policyId,
            flightNumber: flightNumber,
            airline: airline,
            departureTime: departureTime,
            coverageAmount: coverageAmount,
            premium: premium,
            status: 'active' as const,
            createdAt: new Date().toISOString()
          };
          userPolicies.push(newPolicy);
          localStorage.setItem('userPolicies', JSON.stringify(userPolicies));
          
          // Update the state to show the new policy
          setUserPolicies(userPolicies);
          
          setMessage(`✅ Policy created successfully! Policy ID: ${policyId}`);
          
          // Clear form
          setFlightNumber('');
          setAirline('');
          setDepartureTime('');
          setCoverageAmount('');
          setPremium('');
          
          // Refresh policy list
          await getAllPolicyIds();
          
          // Note: Removed auto-cleanup to prevent interference with newly created policies
          
          // Auto-cleanup corrupted policies
          // await autoCleanupCorruptedPolicies();
          
          // Refresh policy list again after cleanup
          // await getAllPolicyIds();
        } else {
          setMessage('❌ Policy created but ID not found in transaction');
        }
      } else {
        setMessage('❌ Failed to create policy');
      }
    } catch (error) {
      console.error('Error creating policy:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const processClaim = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first')
      return
    }

    if (!policyId) {
      setMessage('Please enter a policy ID')
      return
    }

    if (!delayMinutes || parseInt(delayMinutes) <= 0) {
      setMessage('Please enter a valid delay time in minutes')
      return
    }

    setLoading(true)
    setMessage('Processing claim...')

    try {
      // Check if policy ID is a valid Sui object ID format
      if (!policyId.startsWith('0x') || policyId.length !== 66) {
        throw new Error('Invalid policy ID format. Policy ID should be a 64-character hex string starting with 0x')
      }
      
      // Check if policy exists in contract before processing claim
      const policyExists = await checkPolicyExists(policyId);
      if (!policyExists) {
        setMessage('❌ Policy not found in contract. Please check the policy ID.');
        return;
      }
      
      // Additional verification: check if policy is in the pool
      const poolResult = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      let actualPolicyId = policyId; // Default to the provided policy ID
      
      if (poolResult.data && 'content' in poolResult.data && poolResult.data.content && 'fields' in poolResult.data.content) {
        const fields = (poolResult.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          const poolPolicyIds = fields.policy_ids;
          if (!poolPolicyIds.includes(policyId)) {
            console.error('Policy exists as object but not in pool:', policyId);
            console.error('Available policies in pool:', poolPolicyIds);
            
            // Check if this is a known contract bug case - policy exists but wrong ID in pool
            if (poolPolicyIds.length > 0) {
              // Try to find a valid policy ID in the pool that actually exists as an object
              for (const poolPolicyId of poolPolicyIds) {
                const poolPolicyExists = await checkPolicyExists(poolPolicyId);
                if (poolPolicyExists) {
                  console.log('Found valid policy ID in pool:', poolPolicyId);
                  actualPolicyId = poolPolicyId;
                  break;
                }
              }
              
              // If no valid policy found in pool, but our original policy exists, use it
              if (actualPolicyId === policyId) {
                console.log('Detected contract bug: Policy object exists but wrong ID in pool vector');
                console.log('Proceeding with claim using valid policy object...');
                // Continue with the claim since the policy object is valid
              } else {
                console.log('Using alternative policy ID from pool:', actualPolicyId);
              }
            } else {
              setMessage('❌ Policy exists but is not registered in the insurance pool. This may be a contract state issue.');
              return;
            }
          }
        }
      }
      
      // If policy exists in contract but not in localStorage, add it
      const localPolicies = JSON.parse(localStorage.getItem('userPolicies') || '[]');
      const localPolicyIds = localPolicies.map((p: any) => p.policyId);
      if (!localPolicyIds.includes(policyId)) {
        console.log('Policy found in contract but not in localStorage, adding it...');
        const newPolicy = {
          policyId: policyId,
          flightNumber: 'Unknown',
          airline: 'Unknown',
          departureTime: 'Unknown',
          coverageAmount: 'Unknown',
          premium: 'Unknown',
          status: 'active' as const,
          createdAt: new Date().toISOString()
        };
        localPolicies.push(newPolicy);
        localStorage.setItem('userPolicies', JSON.stringify(localPolicies));
        setUserPolicies(localPolicies);
      }
      
      const tx = new TransactionBlock()
      
      // Use the actual policy ID that exists in the contract
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::process_claim`,
        arguments: [
          tx.object(INSURANCE_POOL_ID), // insurance pool
          tx.pure(actualPolicyId), // Use the actual policy ID that exists
          tx.pure(parseInt(delayMinutes), 'u64'),
        ],
      })

      // Sign the transaction
      const signedTx = await signTransactionBlock({ transactionBlock: tx as any })
      
      // Execute the transaction
      const result = await client.executeTransactionBlock({
        transactionBlock: signedTx.transactionBlockBytes,
        signature: signedTx.signature,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })

      console.log('Claim processing result:', result)
      
      // Check transaction status
      if (result.effects?.status?.status === 'success') {
        // Check for claim processed event
        if (result.events) {
          const claimProcessedEvent = result.events.find(event => 
            event.type === `${PACKAGE_ID}::${MODULE_NAME}::ClaimProcessed`
          )
          if (claimProcessedEvent && claimProcessedEvent.parsedJson) {
            const eventData = claimProcessedEvent.parsedJson as any
            const status = eventData.status
            const amount = eventData.amount
            if (status === 'APPROVED') {
              const payoutAmount = amount / 1_000_000_000
              setMessage(`🎉 Claim approved! Payout: ${payoutAmount} SUI`)
              
              // Update policy status in localStorage
              const existingPolicies = JSON.parse(localStorage.getItem('userPolicies') || '[]')
              const updatedPolicies = existingPolicies.map((policy: any) => 
                policy.policyId === policyId 
                  ? { ...policy, status: 'claimed' as const }
                  : policy
              )
              localStorage.setItem('userPolicies', JSON.stringify(updatedPolicies))
              setUserPolicies(updatedPolicies)
            } else {
              setMessage(`❌ Claim rejected. Delay was ${delayMinutes} minutes, but threshold is 1440 minutes (24 hours)`)
            }
          } else {
            setMessage('✅ Claim processed successfully! Check your wallet for payout.')
          }
        } else {
          setMessage('✅ Claim processed successfully! Check your wallet for payout.')
        }
      } else {
        setMessage('❌ Transaction failed. Please try again.')
      }
      
    } catch (error) {
      console.error('Error processing claim:', error)
      let errorMessage = 'Unknown error occurred'
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid policy ID format')) {
          errorMessage = error.message
        } else if (error.message.includes('Object not found')) {
          errorMessage = 'Policy not found. Please check the policy ID.'
        } else if (error.message.includes('Insufficient gas')) {
          errorMessage = 'Insufficient gas for transaction. Please add more SUI to your wallet.'
        } else if (error.message.includes('already claimed')) {
          errorMessage = 'This policy has already been claimed.'
        } else {
          errorMessage = `Error: ${error.message}`
        }
      }
      
      setMessage(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Check if policy exists in contract
  const checkPolicyExists = async (policyId: string) => {
    try {
      const result = await client.getObject({
        id: policyId,
        options: { showContent: true }
      });
      
      console.log('Policy object result:', result);
      
      if (result.data && 'content' in result.data && result.data.content) {
        const content = result.data.content as any;
        if (content.type && content.type.includes('flight_insurance::Policy')) {
          console.log('Policy exists and is valid');
          return true;
        }
      }
      
      console.log('Policy does not exist or is invalid');
      return false;
      
    } catch (error) {
      console.error('Error checking policy existence:', error);
      return false;
    }
  };

  // Get all policy IDs from contract
  const getAllPolicyIds = async () => {
    try {
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      console.log('Insurance pool object:', result);
      
      // Extract policy IDs and balance from the pool
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          console.log('Policy IDs in contract:', fields.policy_ids);
          setContractPolicyIds(fields.policy_ids);
          
          // Also check each policy to see if it's valid
          for (const policyId of fields.policy_ids) {
            const exists = await checkPolicyExists(policyId);
            console.log(`Policy ${policyId} exists: ${exists}`);
          }
        }
        
        // Extract balance if available
        if (fields.balance && fields.balance.fields && fields.balance.fields.value) {
          const balance = parseInt(fields.balance.fields.value);
          setPoolBalance(balance);
          console.log('Pool balance:', balance);
        }
        
        setMessage(`✅ Found ${fields.policy_ids?.length || 0} policies in contract. Pool balance: ${poolBalance ? `${(poolBalance / 1_000_000_000).toFixed(2)} SUI` : 'Unknown'}`);
      }
      
    } catch (error) {
      console.error('Error getting insurance pool:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Get policy details from contract
  const getPolicyDetails = async (policyId: string) => {
    if (!client) return null;
    
    try {
      const result = await client.getObject({
        id: policyId,
        options: { showContent: true }
      });
      
      console.log('Policy details:', result);
      
      // Extract key policy information
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        console.log('Policy fields:', fields);
        
        // The policy object has a nested structure, let's check the value field
        if (fields.value && 'fields' in fields.value) {
          const policyFields = fields.value.fields;
          console.log('Policy value fields:', policyFields);
          
          // Extract key values from the nested structure
          const coverageAmount = policyFields.coverage_amount;
          const premium = policyFields.premium;
          const status = policyFields.status;
          const owner = policyFields.owner;
          
          console.log('Key Policy Information:');
          console.log('- Coverage Amount:', coverageAmount, 'MIST (', coverageAmount / 1_000_000_000, 'SUI)');
          console.log('- Premium:', premium, 'MIST (', premium / 1_000_000_000, 'SUI)');
          console.log('- Status:', status);
          console.log('- Owner:', owner);
          
          return {
            coverageAmount,
            premium,
            status,
            owner
          };
        } else {
          // Try direct field access
          const coverageAmount = fields.coverage_amount;
          const premium = fields.premium;
          const status = fields.status;
          const owner = fields.owner;
          
          console.log('Key Policy Information (direct):');
          console.log('- Coverage Amount:', coverageAmount, 'MIST (', coverageAmount / 1_000_000_000, 'SUI)');
          console.log('- Premium:', premium, 'MIST (', premium / 1_000_000_000, 'SUI)');
          console.log('- Status:', status);
          console.log('- Owner:', owner);
          
          return {
            coverageAmount,
            premium,
            status,
            owner
          };
        }
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting policy details:', error);
      return null;
    }
  };

  // Add funds to insurance pool
  const addFundsToPool = async (amount: string) => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setMessage('Adding funds to pool...');

    try {
      const tx = new TransactionBlock();
      
      // Convert amount to MIST
      const amountMist = Math.floor(parseFloat(amount) * 1_000_000_000);
      
      // Split coins for pool funding
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      
      // Call add_funds_to_pool function
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::add_funds_to_pool`,
        arguments: [
          tx.object(INSURANCE_POOL_ID), // insurance pool
          coin, // the coin we want to add
        ],
      });

      // Sign the transaction
      const signedTx = await signTransactionBlock({ transactionBlock: tx as any });
      
      // Execute the transaction
      const result = await client.executeTransactionBlock({
        transactionBlock: signedTx.transactionBlockBytes,
        signature: signedTx.signature,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log('Add funds result:', result);
      
      if (result.effects?.status?.status === 'success') {
        setMessage(`✅ Successfully added ${amount} SUI to the insurance pool!`);
        // Refresh pool info
        getAllPolicyIds();
      } else {
        setMessage('❌ Failed to add funds to pool');
      }
      
    } catch (error) {
      console.error('Error adding funds to pool:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Verify policy was created in correct pool
  const verifyPolicyInPool = async (policyId: string) => {
    try {
      // Get the policy object
      const policyResult = await client.getObject({
        id: policyId,
        options: { showContent: true }
      });
      
      console.log('Policy object:', policyResult);
      
      // Get the pool object to check if policy is listed
      const poolResult = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      console.log('Pool object:', poolResult);
      
      if (poolResult.data && 'content' in poolResult.data && poolResult.data.content && 'fields' in poolResult.data.content) {
        const fields = (poolResult.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          const isInPool = fields.policy_ids.includes(policyId);
          console.log(`Policy ${policyId} in pool: ${isInPool}`);
          return isInPool;
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('Error verifying policy in pool:', error);
      return false;
    }
  };

  // Get detailed pool information
  const getDetailedPoolInfo = async () => {
    try {
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      console.log('Detailed pool object:', result);
      
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        
        console.log('Pool fields:', fields);
        
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          console.log('Policy IDs in pool:', fields.policy_ids);
          
          // Check each policy individually
          for (const policyId of fields.policy_ids) {
            try {
              const policyResult = await client.getObject({
                id: policyId,
                options: { showContent: true }
              });
              
              if (policyResult.data && 'content' in policyResult.data && policyResult.data.content) {
                console.log(`✅ Policy ${policyId} exists and is valid`);
              } else {
                console.log(`❌ Policy ${policyId} does not exist or is invalid`);
              }
            } catch (error) {
              console.log(`❌ Policy ${policyId} error:`, error);
            }
          }
        }
        
        if (fields.balance && fields.balance.fields && fields.balance.fields.value) {
          const balance = parseInt(fields.balance.fields.value);
          console.log('Pool balance:', balance, 'MIST (', (balance / 1_000_000_000).toFixed(2), 'SUI)');
        }
      }
      
    } catch (error) {
      console.error('Error getting detailed pool info:', error);
    }
  };

  // Clean up corrupted policies
  const cleanupCorruptedPolicies = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setMessage('Cleaning up corrupted policies...');

    try {
      // First, get the current policy IDs from the pool
      const poolObject = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });

      let allPolicyIds: string[] = [];
      
      if (poolObject.data && 'content' in poolObject.data && poolObject.data.content) {
        const content = poolObject.data.content as any;
        if (content.dataType === 'moveObject' && content.fields.policy_ids) {
          allPolicyIds = content.fields.policy_ids;
        }
      }

      console.log('All policy IDs in pool:', allPolicyIds);

      // Check which policy IDs are corrupted (don't exist as objects)
      const corruptedPolicyIds: string[] = [];
      for (const policyId of allPolicyIds) {
        const exists = await checkPolicyExists(policyId);
        if (!exists) {
          corruptedPolicyIds.push(policyId);
        }
      }

      console.log('Corrupted policy IDs to clean up:', corruptedPolicyIds);

      if (corruptedPolicyIds.length === 0) {
        setMessage('✅ No corrupted policies found!');
        return;
      }

      const tx = new TransactionBlock();
      
      // Clean up corrupted policies
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::cleanup_corrupted_policies`,
        arguments: [
          tx.object(INSURANCE_POOL_ID),
          tx.pure(corruptedPolicyIds),
        ],
      });

      // Sign the transaction
      const signedTx = await signTransactionBlock({ transactionBlock: tx as any });
      
      // Execute the transaction
      const result = await client.executeTransactionBlock({
        transactionBlock: signedTx.transactionBlockBytes,
        signature: signedTx.signature,
        options: { showEffects: true, showObjectChanges: true }
      });

      console.log('Cleanup result:', result);
      
      if (result.effects?.status?.status === 'success') {
        setMessage(`✅ Cleaned up ${corruptedPolicyIds.length} corrupted policies successfully!`);
        // Refresh pool info
        await getAllPolicyIds();
      } else {
        setMessage('❌ Failed to clean up corrupted policies');
      }
    } catch (error) {
      console.error('Error cleaning up policies:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Check if policy exists in pool table (direct contract call)
  const checkPolicyInPoolTable = async (policyId: string) => {
    try {
      const tx = new TransactionBlock();
      
      // Call the contract's policy_exists function
      const result = tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::check_policy_exists`,
        arguments: [
          tx.object(INSURANCE_POOL_ID),
          tx.pure(policyId),
        ],
      });

      // For now, just log the transaction (we can't easily get the return value in dry run)
      console.log('Checking policy in pool table:', policyId);
      console.log('Transaction for policy check:', tx);
      
      // Try to get the policy object directly as well
      const policyResult = await client.getObject({
        id: policyId,
        options: { showContent: true }
      });
      
      console.log('Policy object result:', policyResult);
      
      if (policyResult.data && 'content' in policyResult.data && policyResult.data.content) {
        const content = policyResult.data.content as any;
        if (content.type && content.type.includes('flight_insurance::Policy')) {
          console.log(`✅ Policy ${policyId} exists as a valid policy object`);
          return true;
        }
      }
      
      console.log(`❌ Policy ${policyId} does not exist as a valid policy object`);
      return false;
      
    } catch (error) {
      console.error('Error checking policy in pool table:', error);
      return false;
    }
  };

  // Get detailed pool table information
  const getPoolTableInfo = async () => {
    try {
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      console.log('Pool object for table analysis:', result);
      
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        
        console.log('Pool fields for table analysis:', fields);
        
        if (fields.policies) {
          console.log('Policies table structure:', fields.policies);
        }
        
        if (fields.policy_ids) {
          console.log('Policy IDs array:', fields.policy_ids);
          console.log('Policy IDs length:', fields.policy_ids.length);
        }
        
        if (fields.balance) {
          console.log('Balance structure:', fields.balance);
        }
      }
      
    } catch (error) {
      console.error('Error getting pool table info:', error);
    }
  };

  // Debug function to check pool state before and after policy creation
  const debugPolicyCreation = async () => {
    try {
      console.log('=== DEBUGGING POLICY CREATION ===');
      
      // Get pool state before
      console.log('Pool state BEFORE policy creation:');
      const poolBefore = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      console.log('Pool object before:', poolBefore);
      
      if (poolBefore.data && 'content' in poolBefore.data && poolBefore.data.content) {
        const content = poolBefore.data.content as any;
        if (content.dataType === 'moveObject') {
          const fields = content.fields;
          console.log('Pool fields before:', fields);
          console.log('Policy IDs before:', fields.policy_ids);
          console.log('Policies table before:', fields.policies);
        }
      }
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get pool state after
      console.log('Pool state AFTER policy creation:');
      const poolAfter = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      console.log('Pool object after:', poolAfter);
      
      if (poolAfter.data && 'content' in poolAfter.data && poolAfter.data.content) {
        const content = poolAfter.data.content as any;
        if (content.dataType === 'moveObject') {
          const fields = content.fields;
          console.log('Pool fields after:', fields);
          console.log('Policy IDs after:', fields.policy_ids);
          console.log('Policies table after:', fields.policies);
        }
      }
      
      console.log('=== END DEBUGGING ===');
      
    } catch (error) {
      console.error('Error debugging policy creation:', error);
    }
  };

  // Verify pool ownership and permissions
  const verifyPoolAccess = async () => {
    try {
      console.log('=== VERIFYING POOL ACCESS ===');
      
      // Get pool object
      const poolObject = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true, showOwner: true }
      });
      
      console.log('Pool object with owner:', poolObject);
      
      if (poolObject.data && 'owner' in poolObject.data) {
        const owner = poolObject.data.owner;
        console.log('Pool owner:', owner);
        console.log('Current user address:', currentAccount?.address);
        console.log('Can modify pool:', owner === currentAccount?.address);
        
        if (owner === currentAccount?.address) {
          alert('✅ Pool ownership verified - you can modify this pool');
        } else {
          alert('❌ Pool ownership issue - you cannot modify this pool');
        }
      }
      
      // Check if pool is shared or immutable
      if (poolObject.data && 'content' in poolObject.data && poolObject.data.content) {
        const content = poolObject.data.content as any;
        console.log('Pool content type:', content.dataType);
        console.log('Pool content fields:', content.fields);
      }
      
    } catch (error) {
      console.error('Error verifying pool access:', error);
      alert('Error verifying pool access');
    }
  };

  // Create a new insurance pool owned by the current user
  const createNewPool = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setMessage('Creating new insurance pool...');

    try {
      const tx = new TransactionBlock();
      
      // Create a new insurance pool
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::create_insurance_pool`,
        arguments: [],
      });

      // Sign the transaction
      const signedTx = await signTransactionBlock({ transactionBlock: tx as any });
      
      // Execute the transaction
      const result = await client.executeTransactionBlock({
        transactionBlock: signedTx.transactionBlockBytes,
        signature: signedTx.signature,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log('Create pool result:', result);
      
      if (result.effects?.status?.status === 'success') {
        // Find the created pool object
        const createdObjects = result.objectChanges?.filter(change => 
          change.type === 'created' && 
          'objectType' in change && 
          change.objectType?.includes('flight_insurance::InsurancePool')
        );
        
        if (createdObjects && createdObjects.length > 0) {
          const createdObject = createdObjects[0] as any;
          const newPoolId = createdObject.objectId;
          
          setMessage(`✅ New insurance pool created! Pool ID: ${newPoolId}`);
          
          // Update the environment variable and reload
          alert(`New pool created! Please update your .env file with the new pool ID: ${newPoolId} and restart the application.`);
          
        } else {
          setMessage('❌ Pool created but could not find pool ID');
        }
      } else {
        setMessage('❌ Failed to create pool');
      }
      
    } catch (error) {
      console.error('Error creating pool:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Deploy a new contract with a fresh pool
  const deployNewContract = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setMessage('Deploying new contract with fresh pool...');

    try {
      // This would require building and deploying the contract
      // For now, let's provide instructions
      setMessage('To create a new pool, you need to deploy a new contract. Please run:');
      
      const instructions = `
1. Navigate to the contract directory: cd packages/contract
2. Build the contract: sui move build
3. Deploy the contract: sui client publish --gas-budget 100000000
4. Update your .env file with the new package ID and pool ID
5. Restart the application
      `;
      
      alert(`Deploy New Contract Instructions:\n\n${instructions}`);
      
    } catch (error) {
      console.error('Error deploying contract:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Manually add policy to pool table (for testing)
  const manuallyAddPolicyToPool = async () => {
    if (!currentAccount) {
      setMessage('Please connect your wallet first');
      return;
    }

    const policyId = prompt('Enter policy ID to add to pool:');
    if (!policyId) return;

    setLoading(true);
    setMessage('Manually adding policy to pool...');

    try {
      const tx = new TransactionBlock();
      
      // This would require a function in the contract to manually add policies
      // For now, let's just log what we're trying to do
      console.log('Attempting to manually add policy to pool:', policyId);
      console.log('This would require a contract function to add policies manually');
      
      setMessage('❌ Manual policy addition not implemented in contract');
      
    } catch (error) {
      console.error('Error manually adding policy:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-cleanup corrupted policies automatically
  const autoCleanupCorruptedPolicies = async () => {
    try {
      console.log('🔧 Auto-cleaning corrupted policies...');
      
      // Get current pool state
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          const policyIds = fields.policy_ids;
          const corruptedIds: string[] = [];
          
          // Check each policy ID
          for (const policyId of policyIds) {
            const exists = await checkPolicyExists(policyId);
            if (!exists) {
              corruptedIds.push(policyId);
            }
          }
          
          // Clean up if there are corrupted IDs
          if (corruptedIds.length > 0) {
            console.log('Found corrupted policy IDs:', corruptedIds);
            
            const tx = new TransactionBlock();
            tx.moveCall({
              target: `${PACKAGE_ID}::${MODULE_NAME}::cleanup_corrupted_policies`,
              arguments: [
                tx.object(INSURANCE_POOL_ID),
                tx.pure(corruptedIds),
              ],
            });
            
            const signedTx = await signTransactionBlock({ transactionBlock: tx as any });
            const cleanupResult = await client.executeTransactionBlock({
              transactionBlock: signedTx.transactionBlockBytes,
              signature: signedTx.signature,
              options: { showEffects: true },
            });
            
            console.log('Auto-cleanup result:', cleanupResult);
            return true;
          } else {
            console.log('No corrupted policies found');
            return false;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error in auto-cleanup:', error);
      return false;
    }
  };

  // NEW: Debug and fix policy ID mismatch
  const debugAndFixPolicyMismatch = async () => {
    try {
      console.log('🔍 DEBUGGING POLICY ID MISMATCH...');
      
      // Get localStorage policies
      const localPolicies = JSON.parse(localStorage.getItem('userPolicies') || '[]');
      console.log('LocalStorage policies:', localPolicies);
      
      // Get contract policies
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      let contractPolicyIds: string[] = [];
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          contractPolicyIds = fields.policy_ids;
        }
      }
      console.log('Contract policy IDs:', contractPolicyIds);
      
      // Find mismatches
      const localIds = localPolicies.map((p: any) => p.policyId);
      const missingInContract = localIds.filter(id => !contractPolicyIds.includes(id));
      const missingInLocal = contractPolicyIds.filter(id => !localIds.includes(id));
      
      console.log('Policies in localStorage but not in contract:', missingInContract);
      console.log('Policies in contract but not in localStorage:', missingInLocal);
      
      // Check if each local policy actually exists as an object
      const validLocalPolicies = [];
      for (const policy of localPolicies) {
        const exists = await checkPolicyExists(policy.policyId);
        console.log(`Policy ${policy.policyId} exists as object: ${exists}`);
        if (exists) {
          validLocalPolicies.push(policy);
        }
      }
      
      // Update localStorage with only valid policies
      if (validLocalPolicies.length !== localPolicies.length) {
        console.log('Updating localStorage with only valid policies...');
        localStorage.setItem('userPolicies', JSON.stringify(validLocalPolicies));
        setUserPolicies(validLocalPolicies);
        alert(`Fixed localStorage: Removed ${localPolicies.length - validLocalPolicies.length} invalid policies`);
      }
      
      // Summary
      const summary = {
        totalLocalPolicies: localPolicies.length,
        totalContractPolicies: contractPolicyIds.length,
        validLocalPolicies: validLocalPolicies.length,
        missingInContract,
        missingInLocal
      };
      
      console.log('MISMATCH SUMMARY:', summary);
      alert(`Debug complete! Check console for details.\n\nSummary:\n- Local policies: ${summary.totalLocalPolicies}\n- Contract policies: ${summary.totalContractPolicies}\n- Valid local policies: ${summary.validLocalPolicies}\n- Missing in contract: ${summary.missingInContract.length}\n- Missing in local: ${summary.missingInLocal.length}`);
      
      return summary;
      
    } catch (error) {
      console.error('Error debugging policy mismatch:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  // NEW: Get the most recent policy ID from contract
  const getMostRecentPolicyId = async () => {
    try {
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids) && fields.policy_ids.length > 0) {
          // Get the last policy ID (most recent)
          const mostRecentPolicyId = fields.policy_ids[fields.policy_ids.length - 1];
          console.log('Most recent policy ID:', mostRecentPolicyId);
          
          // Set it in the policy ID field for easy access
          setPolicyId(mostRecentPolicyId);
          
          alert(`Most recent policy ID: ${mostRecentPolicyId}\n\nThis ID has been copied to the policy ID field for your convenience.`);
          return mostRecentPolicyId;
        } else {
          alert('No policies found in the contract.');
          return null;
        }
      }
      
      alert('Could not retrieve policy IDs from contract.');
      return null;
      
    } catch (error) {
      console.error('Error getting most recent policy ID:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  // NEW: Debug UI vs Contract policy ID mismatch
  const debugUIVsContractPolicyId = async () => {
    try {
      console.log('🔍 DEBUGGING UI vs CONTRACT POLICY ID MISMATCH...');
      
      // Get current UI policy ID
      const uiPolicyId = policyId;
      console.log('UI Policy ID:', uiPolicyId);
      
      // Get contract policy IDs
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      let contractPolicyIds: string[] = [];
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          contractPolicyIds = fields.policy_ids;
        }
      }
      console.log('Contract Policy IDs:', contractPolicyIds);
      
      // Check if UI policy ID exists in contract
      const uiPolicyExistsInContract = contractPolicyIds.includes(uiPolicyId);
      console.log('UI Policy ID exists in contract:', uiPolicyExistsInContract);
      
      // Check if UI policy ID exists as an object
      let uiPolicyExistsAsObject = false;
      if (uiPolicyId) {
        uiPolicyExistsAsObject = await checkPolicyExists(uiPolicyId);
        console.log('UI Policy ID exists as object:', uiPolicyExistsAsObject);
      }
      
      // Get localStorage policies
      const localPolicies = JSON.parse(localStorage.getItem('userPolicies') || '[]');
      const localPolicyIds = localPolicies.map((p: any) => p.policyId);
      console.log('localStorage Policy IDs:', localPolicyIds);
      
      // Summary
      const summary = {
        uiPolicyId,
        uiPolicyExistsInContract,
        uiPolicyExistsAsObject,
        contractPolicyIds,
        localPolicyIds,
        contractPolicyCount: contractPolicyIds.length,
        localPolicyCount: localPolicyIds.length
      };
      
      console.log('UI vs CONTRACT SUMMARY:', summary);
      
      let message = `UI Policy ID: ${uiPolicyId}\n`;
      message += `Exists in contract: ${uiPolicyExistsInContract}\n`;
      message += `Exists as object: ${uiPolicyExistsAsObject}\n`;
      message += `Contract policies: ${contractPolicyIds.length}\n`;
      message += `localStorage policies: ${localPolicyIds.length}\n\n`;
      
      if (!uiPolicyExistsInContract) {
        message += '❌ UI Policy ID is NOT in contract!\n';
        if (contractPolicyIds.length > 0) {
          message += `✅ Use this policy ID instead: ${contractPolicyIds[contractPolicyIds.length - 1]}`;
        }
      } else {
        message += '✅ UI Policy ID is in contract!';
      }
      
      alert(message);
      return summary;
      
    } catch (error) {
      console.error('Error debugging UI vs Contract mismatch:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  // NEW: Find correct policy ID for claims
  const findCorrectPolicyId = async () => {
    try {
      console.log('🔍 FINDING CORRECT POLICY ID FOR CLAIMS...');
      
      // Get current UI policy ID
      const uiPolicyId = policyId;
      console.log('UI Policy ID:', uiPolicyId);
      
      // Check if UI policy ID exists as an object (only if not empty)
      let uiPolicyExistsAsObject = false;
      if (uiPolicyId && uiPolicyId.trim() !== '') {
        uiPolicyExistsAsObject = await checkPolicyExists(uiPolicyId);
        console.log('UI Policy ID exists as object:', uiPolicyExistsAsObject);
      } else {
        console.log('UI Policy ID is empty, skipping object check');
      }
      
      // Get contract policy IDs
      const result = await client.getObject({
        id: INSURANCE_POOL_ID,
        options: { showContent: true }
      });
      
      let contractPolicyIds: string[] = [];
      if (result.data && 'content' in result.data && result.data.content && 'fields' in result.data.content) {
        const fields = (result.data.content as any).fields;
        if (fields.policy_ids && Array.isArray(fields.policy_ids)) {
          contractPolicyIds = fields.policy_ids;
        }
      }
      console.log('Contract Policy IDs:', contractPolicyIds);
      
      // Find valid policy IDs
      const validPolicyIds: string[] = [];
      for (const poolPolicyId of contractPolicyIds) {
        const exists = await checkPolicyExists(poolPolicyId);
        if (exists) {
          validPolicyIds.push(poolPolicyId);
        }
      }
      console.log('Valid Policy IDs in pool:', validPolicyIds);
      
      // Determine which policy ID to use
      let recommendedPolicyId = uiPolicyId;
      let reason = '';
      
      if (uiPolicyId && uiPolicyId.trim() !== '' && uiPolicyExistsAsObject) {
        if (contractPolicyIds.includes(uiPolicyId)) {
          reason = '✅ UI Policy ID exists as object and is in pool - use this';
        } else {
          if (validPolicyIds.length > 0) {
            recommendedPolicyId = validPolicyIds[0];
            reason = `⚠️ UI Policy ID exists as object but not in pool. Use pool policy ID: ${recommendedPolicyId}`;
          } else {
            reason = '⚠️ UI Policy ID exists as object but pool has no valid policies - try UI Policy ID anyway';
          }
        }
      } else if (uiPolicyId && uiPolicyId.trim() !== '' && !uiPolicyExistsAsObject) {
        if (validPolicyIds.length > 0) {
          recommendedPolicyId = validPolicyIds[0];
          reason = `❌ UI Policy ID does not exist. Use pool policy ID: ${recommendedPolicyId}`;
        } else {
          reason = '❌ UI Policy ID does not exist and no valid policies found in pool';
        }
      } else {
        // UI Policy ID is empty
        if (validPolicyIds.length > 0) {
          recommendedPolicyId = validPolicyIds[0];
          reason = `📝 No UI Policy ID entered. Use pool policy ID: ${recommendedPolicyId}`;
        } else {
          reason = '❌ No valid policies found anywhere. Please create a new policy first.';
        }
      }
      
      const summary = {
        uiPolicyId,
        uiPolicyExistsAsObject,
        contractPolicyIds,
        validPolicyIds,
        recommendedPolicyId,
        reason
      };
      
      console.log('POLICY ID RECOMMENDATION:', summary);
      
      let message = `UI Policy ID: ${uiPolicyId || '(empty)'}\n`;
      message += `Exists as object: ${uiPolicyExistsAsObject}\n`;
      message += `Contract policies: ${contractPolicyIds.length}\n`;
      message += `Valid policies: ${validPolicyIds.length}\n\n`;
      message += `RECOMMENDATION:\n${reason}\n\n`;
      
      if (recommendedPolicyId && recommendedPolicyId.trim() !== '') {
        message += `Recommended Policy ID: ${recommendedPolicyId}`;
        
        // Ask user if they want to set this policy ID
        const shouldSet = confirm(`${message}\n\nWould you like to set this as the current policy ID?`);
        if (shouldSet) {
          setPolicyId(recommendedPolicyId);
          console.log('✅ Policy ID set to:', recommendedPolicyId);
        }
      } else {
        message += `No valid policy ID found. Please create a new policy.`;
      }
      
      alert(message);
      return summary;
      
    } catch (error) {
      console.error('Error finding correct policy ID:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 relative">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-r from-pink-500/20 to-red-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            <div className="absolute top-40 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
          </div>

          {/* Floating icons */}
          <div className="relative z-10 mb-8">
            <div className="flex items-center justify-center space-x-8 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-2xl shadow-2xl animate-float">
                <Plane className="w-8 h-8 text-white" />
              </div>
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-2xl shadow-2xl animate-float" style={{ animationDelay: '1s' }}>
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="bg-gradient-to-r from-pink-500 to-red-600 p-4 rounded-2xl shadow-2xl animate-float" style={{ animationDelay: '2s' }}>
                <Clock className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          {/* Main title with enhanced styling */}
          <div className="relative z-10">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-500 via-pink-500 to-emerald-400 bg-clip-text text-transparent animate-gradient">
              Flight Delay Insurance
            </h1>
            <p className="text-xl text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
              Decentralized parametric insurance on Sui Testnet
            </p>
          </div>
          
          {/* Wallet Connection - Moved to header */}
          <div className="flex justify-end mb-8 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
              <ConnectButton />
            </div>
          </div>
          
          {/* Product Benefits Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-green-500/20 p-3 rounded-lg mr-4">
                  <Clock className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Instant Payouts</p>
                  <p className="text-lg font-bold text-white">Automated</p>
                  <p className="text-xs text-gray-400 mt-1">No paperwork needed</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-blue-500/20 p-3 rounded-lg mr-4">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Trustless</p>
                  <p className="text-lg font-bold text-white">Transparent</p>
                  <p className="text-xs text-gray-400 mt-1">On-chain verification</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-purple-500/20 p-3 rounded-lg mr-4">
                  <Plane className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Global Coverage</p>
                  <p className="text-lg font-bold text-white">Worldwide</p>
                  <p className="text-xs text-gray-400 mt-1">Any flight, anywhere</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-emerald-500/20 p-3 rounded-lg mr-4">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Data-Driven</p>
                  <p className="text-lg font-bold text-white">Objective</p>
                  <p className="text-xs text-gray-400 mt-1">Real-time flight data</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentAccount ? (
          <div className="max-w-6xl mx-auto">
            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab('create')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      activeTab === 'create'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <Plane className="w-4 h-4 inline mr-2" />
                    Create Policy
                  </button>
                  <button
                    onClick={() => setActiveTab('claim')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      activeTab === 'claim'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FileText className="w-5 h-5 mr-2 inline" />
                    Claims
                  </button>
                  <button
                    onClick={() => setActiveTab('debug')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      activeTab === 'debug'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Bug className="w-5 h-5 mr-2 inline" />
                    Debug
                  </button>
                </div>
              </div>
            </div>

            {activeTab === 'create' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Flight Search */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                    <Search className="w-6 h-6 mr-3 text-blue-400" />
                    Search Flight Data
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Flight Number (IATA)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={searchFlight}
                          onChange={(e) => {
                            setSearchFlight(e.target.value)
                            setShowFlightSuggestions(e.target.value.length > 0)
                          }}
                          onFocus={() => setShowFlightSuggestions(searchFlight.length > 0)}
                          onBlur={() => setTimeout(() => setShowFlightSuggestions(false), 200)}
                          placeholder="e.g., AA123, DL456, UA789"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                        />
                        {showFlightSuggestions && searchFlight.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white/95 backdrop-blur-sm rounded-lg border border-white/20 shadow-xl max-h-60 overflow-y-auto">
                            {getFlightSuggestions(searchFlight).map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setSearchFlight(suggestion.flight)
                                  setFlightNumber(suggestion.flight)
                                  setAirline(suggestion.airline)
                                  setDepartureTime(suggestion.departureTime)
                                  setCoverageAmount('1.0')
                                  setPremium('0.1')
                                  setMessage(`Selected: ${suggestion.airline} ${suggestion.flight}`)
                                  setShowFlightSuggestions(false)
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-blue-500/20 transition-colors border-b border-white/10 last:border-b-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-gray-900 font-medium">{suggestion.flight}</div>
                                    <div className="text-gray-600 text-sm">{suggestion.airline}</div>
                                  </div>
                                  <div className="text-gray-500 text-sm">
                                    {suggestion.route}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Airline
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={airline}
                            onChange={(e) => {
                              setAirline(e.target.value)
                              setShowAirlineSuggestions(e.target.value.length > 0)
                            }}
                            onFocus={() => setShowAirlineSuggestions(airline.length > 0)}
                            onBlur={() => setTimeout(() => setShowAirlineSuggestions(false), 200)}
                            placeholder="e.g., American Airlines"
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                          />
                          {showAirlineSuggestions && airline.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white/95 backdrop-blur-sm rounded-lg border border-white/20 shadow-xl max-h-60 overflow-y-auto">
                              {getAirlineSuggestions(airline).map((suggestion, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    setAirline(suggestion)
                                    setShowAirlineSuggestions(false)
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-blue-500/20 transition-colors border-b border-white/10 last:border-b-0 text-gray-900"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Route
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g., JFK-LAX, LAX-SFO"
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                            onChange={(e) => {
                              const route = e.target.value
                              if (route.includes('-')) {
                                const [from, to] = route.split('-')
                                // Auto-fill with popular routes
                                const popularRoute = getPopularRoute(from.trim(), to.trim())
                                if (popularRoute) {
                                  setFlightNumber(popularRoute.flight)
                                  setAirline(popularRoute.airline)
                                  setDepartureTime(popularRoute.departureTime)
                                  setCoverageAmount('1.0')
                                  setPremium('0.1')
                                  setMessage(`Found popular route: ${popularRoute.airline} ${popularRoute.flight}`)
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Popular Airlines
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {['American Airlines', 'Delta', 'United', 'Southwest', 'JetBlue', 'Alaska'].map((airlineName) => (
                            <button
                              key={airlineName}
                              onClick={() => {
                                setAirline(airlineName)
                                setShowAirlineSuggestions(false)
                                setMessage(`Selected airline: ${airlineName}`)
                              }}
                              className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm hover:bg-blue-500/30 transition-colors"
                            >
                              {airlineName}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Popular Routes
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {['JFK-LAX', 'LAX-SFO', 'ORD-LAX', 'ATL-LAX', 'JFK-SFO'].map((route) => (
                            <button
                              key={route}
                              onClick={() => {
                                const popularRoute = getPopularRoute(route.split('-')[0], route.split('-')[1])
                                if (popularRoute) {
                                  setFlightNumber(popularRoute.flight)
                                  setAirline(popularRoute.airline)
                                  setDepartureTime(popularRoute.departureTime)
                                  setCoverageAmount('1.0')
                                  setPremium('0.1')
                                  setShowFlightSuggestions(false)
                                  setShowAirlineSuggestions(false)
                                  setMessage(`Selected route: ${popularRoute.airline} ${popularRoute.flight}`)
                                }
                              }}
                              className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm hover:bg-purple-500/30 transition-colors"
                            >
                              {route}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Demo Flight Data Button */}
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          setFlightNumber('AA123')
                          setAirline('American Airlines')
                          setDepartureTime(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16))
                          setCoverageAmount('1.0')
                          setPremium('0.1')
                          setMessage('Demo flight data loaded! You can now create a test policy.')
                        }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all transform hover:scale-105 font-medium"
                      >
                        <Plane className="w-4 h-4 inline mr-2" />
                        Load Demo Flight Data
                      </button>
                    </div>
                  </div>
                </div>

                {/* Create Policy Form */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                    <Shield className="w-6 h-6 mr-3 text-green-400" />
                    Create Insurance Policy
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Flight Number
                        </label>
                        <input
                          type="text"
                          value={flightNumber}
                          onChange={(e) => setFlightNumber(e.target.value)}
                          placeholder="e.g., AA123"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Airline
                        </label>
                        <input
                          type="text"
                          value={airline}
                          onChange={(e) => {
                            setAirline(e.target.value)
                            setShowAirlineSuggestions(e.target.value.length > 0)
                          }}
                          onFocus={() => setShowAirlineSuggestions(airline.length > 0)}
                          onBlur={() => setTimeout(() => setShowAirlineSuggestions(false), 200)}
                          placeholder="e.g., American Airlines"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                        />
                        {showAirlineSuggestions && airline.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white/95 backdrop-blur-sm rounded-lg border border-white/20 shadow-xl max-h-60 overflow-y-auto">
                            {getAirlineSuggestions(airline).map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setAirline(suggestion)
                                  setShowAirlineSuggestions(false)
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-blue-500/20 transition-colors border-b border-white/10 last:border-b-0 text-gray-900"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Departure Time
                      </label>
                      <input
                        type="datetime-local"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Coverage Amount (SUI)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={coverageAmount}
                          onChange={(e) => setCoverageAmount(e.target.value)}
                          placeholder="1.0"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Premium (SUI)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={premium}
                          onChange={(e) => setPremium(e.target.value)}
                          placeholder="0.1"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                        />
                      </div>
                    </div>

                    <button
                      onClick={createPolicy}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium text-lg transition-all transform hover:scale-105"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      ) : (
                        <DollarSign className="w-6 h-6 mr-3" />
                      )}
                      Create Policy
                    </button>
                    
                    {/* Policy Creation Success Display */}
                    {policyId && (
                      <div className="mt-6 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-6 border border-green-500/30">
                        <div className="flex items-center mb-4">
                          <CheckCircle className="w-8 h-8 text-green-400 mr-3" />
                          <h3 className="text-xl font-semibold text-white">Policy Created Successfully!</h3>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="bg-white/10 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-300 text-sm">Policy ID:</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(policyId)
                                  setMessage('Policy ID copied to clipboard!')
                                }}
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="bg-gray-800/50 rounded p-3">
                              <span className="text-green-400 font-mono text-sm break-all">{policyId}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">Flight:</span>
                              <span className="text-white ml-2 font-medium">{userPolicies.find(p => p.policyId === policyId)?.flightNumber}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Airline:</span>
                              <span className="text-white ml-2 font-medium">{userPolicies.find(p => p.policyId === policyId)?.airline}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Coverage:</span>
                              <span className="text-green-400 ml-2 font-medium">{userPolicies.find(p => p.policyId === policyId)?.coverageAmount} SUI</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Premium:</span>
                              <span className="text-yellow-400 ml-2 font-medium">{userPolicies.find(p => p.policyId === policyId)?.premium} SUI</span>
                            </div>
                          </div>
                          
                          <div className="flex space-x-3 mt-4">
                            <button
                              onClick={() => {
                                setActiveTab('claim')
                                setMessage('Switched to claim processing tab. Your policy is ready for claims!')
                              }}
                              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 px-4 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all text-sm font-medium"
                            >
                              Process Claim
                            </button>
                            <button
                              onClick={() => {
                                setPolicyId('')
                                setMessage('Ready to create another policy')
                              }}
                              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all text-sm font-medium"
                            >
                              Create Another
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-6">
                {/* User's Policies Section */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                    <Shield className="w-6 h-6 mr-3 text-blue-400" />
                    Your Insurance Policies
                  </h2>
                  
                  {userPolicies.length === 0 ? (
                    <div className="text-center py-8">
                      <Plane className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg mb-2">No policies found</p>
                      <p className="text-gray-500 text-sm">Create a policy in the "Create Policy" tab to get started</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userPolicies.map((policy, index) => (
                        <div key={index} className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${
                                policy.status === 'active' ? 'bg-green-400' : 
                                policy.status === 'claimed' ? 'bg-blue-400' : 'bg-gray-400'
                              }`}></div>
                              <span className="text-sm font-medium text-gray-300 capitalize">{policy.status}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(policy.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between">
                              <span className="text-gray-400 text-sm">Flight:</span>
                              <span className="text-white font-medium">{policy.flightNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 text-sm">Airline:</span>
                              <span className="text-white font-medium">{policy.airline}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 text-sm">Coverage:</span>
                              <span className="text-green-400 font-medium">{policy.coverageAmount} SUI</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 text-sm">Premium:</span>
                              <span className="text-yellow-400 font-medium">{policy.premium} SUI</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-xs text-gray-400 block">Policy ID:</span>
                              <span className="text-xs text-blue-300 font-mono break-all">{policy.policyId}</span>
                            </div>
                            
                            {policy.status === 'active' && (
                              <button
                                onClick={() => {
                                  setPolicyId(policy.policyId)
                                  setMessage(`Selected policy: ${policy.flightNumber} (${policy.policyId})`)
                                }}
                                className="w-full px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded text-sm hover:from-green-600 hover:to-emerald-700 transition-all"
                              >
                                Select for Claim
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Process Claim Form */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                    <FileText className="w-6 h-6 mr-3 text-green-400" />
                    Process Claim
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Claim Information */}
                    <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                      <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-blue-400" />
                        Claim Requirements
                      </h3>
                      <div className="text-sm text-gray-300 space-y-1">
                        <p>• Minimum delay: <span className="text-yellow-400 font-medium">1440 minutes (24 hours)</span></p>
                        <p>• Policy must be active and not previously claimed</p>
                        <p>• Automatic payout upon approval</p>
                        <p>• No manual verification required</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Policy ID
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={policyId}
                            onChange={(e) => setPolicyId(e.target.value)}
                            placeholder="Enter policy ID from created policy"
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                          />
                          {policyId && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              {policyId.startsWith('0x') && policyId.length === 66 ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                          )}
                        </div>
                        {policyId && !policyId.startsWith('0x') && (
                          <p className="text-red-400 text-sm mt-1">Policy ID should start with 0x</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Flight Delay (minutes)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={delayMinutes}
                            onChange={(e) => setDelayMinutes(e.target.value)}
                            placeholder="1440"
                            min="0"
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                          />
                          {delayMinutes && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              {parseInt(delayMinutes) >= 1440 ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm text-gray-400">
                            Minimum: <span className="text-yellow-400 font-medium">1440 minutes (24 hours)</span>
                          </p>
                          {delayMinutes && (
                            <p className={`text-sm font-medium ${
                              parseInt(delayMinutes) >= 1440 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {parseInt(delayMinutes) >= 1440 ? '✅ Eligible' : '❌ Below threshold'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Selected Policy Preview */}
                      {policyId && userPolicies.find(p => p.policyId === policyId) && (
                        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20">
                          <h4 className="text-sm font-medium text-green-400 mb-2">Selected Policy</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-400">Flight:</span>
                              <span className="text-white ml-2">{userPolicies.find(p => p.policyId === policyId)?.flightNumber}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Coverage:</span>
                              <span className="text-green-400 ml-2">{userPolicies.find(p => p.policyId === policyId)?.coverageAmount} SUI</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Status:</span>
                              <span className="text-blue-400 ml-2 capitalize">{userPolicies.find(p => p.policyId === policyId)?.status}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Premium:</span>
                              <span className="text-yellow-400 ml-2">{userPolicies.find(p => p.policyId === policyId)?.premium} SUI</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-4">
                        <button
                          onClick={processClaim}
                          disabled={loading || !policyId || !delayMinutes || parseInt(delayMinutes) <= 0 || !policyId.startsWith('0x')}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium text-lg transition-all transform hover:scale-105"
                        >
                          {loading ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                          ) : (
                            <FileText className="w-6 h-6 mr-3" />
                          )}
                          {loading ? 'Processing Claim...' : 'Process Claim'}
                        </button>
                        
                        <button
                          onClick={async () => {
                            if (policyId) {
                              const exists = await checkPolicyExists(policyId);
                              alert(`Policy ${policyId} exists in contract: ${exists}`);
                            } else {
                              alert('Please enter a policy ID first');
                            }
                          }}
                          className="px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center"
                          title="Check if policy exists in contract"
                        >
                          <Bug className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Debug Section */}
            {activeTab === 'debug' && (
              <div className="space-y-6">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-4">Debug Information</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">Contract Addresses</h4>
                      <div className="bg-black/20 rounded-lg p-3 space-y-2">
                        <p className="text-sm text-gray-300">
                          Package ID: {PACKAGE_ID}
                        </p>
                        <p className="text-sm text-gray-300">
                          Pool ID: {INSURANCE_POOL_ID}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">Local Policies</h4>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-sm text-gray-300 mb-2">
                          Total policies in localStorage: {userPolicies.length}
                        </p>
                        {userPolicies.map((policy, index) => (
                          <div key={index} className="text-xs text-gray-400 mb-1">
                            Policy {index + 1}: {policy.policyId}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            localStorage.removeItem('userPolicies');
                            window.location.reload();
                          }}
                          className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                        >
                          Clear localStorage
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">Contract Policies</h4>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-sm text-gray-300 mb-2">
                          Total policies in contract: {contractPolicyIds.length}
                        </p>
                        {contractPolicyIds.map((policyId, index) => (
                          <div key={index} className="text-xs text-gray-400 mb-1">
                            Policy {index + 1}: {policyId}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        onClick={async () => {
                          await debugAndFixPolicyMismatch();
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-bold"
                      >
                        🔍 Debug Policy ID Mismatch
                      </button>
                      
                      <button
                        onClick={async () => {
                          await getMostRecentPolicyId();
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-bold"
                      >
                        📋 Get Most Recent Policy ID
                      </button>
                      
                      <button
                        onClick={async () => {
                          await debugUIVsContractPolicyId();
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-bold"
                      >
                        🔍 Debug UI vs Contract Mismatch
                      </button>
                      
                      <button
                        onClick={async () => {
                          await findCorrectPolicyId();
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-bold"
                      >
                        🎯 Find Correct Policy ID for Claims
                      </button>
                      
                      <button
                        onClick={async () => {
                          if (policyId) {
                            const exists = await checkPolicyExists(policyId);
                            alert(`Policy ${policyId} exists in contract: ${exists}`);
                          } else {
                            alert('Please enter a policy ID first');
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Check Policy ID
                      </button>
                      
                      <button
                        onClick={async () => {
                          await getAllPolicyIds();
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Get Pool Info
                      </button>
                      
                      <button
                        onClick={async () => {
                          if (policyId) {
                            const details = await getPolicyDetails(policyId);
                            if (details) {
                              alert(`Policy details loaded. Check console for full details.`);
                            } else {
                              alert('Could not load policy details');
                            }
                          } else {
                            alert('Please enter a policy ID first');
                          }
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                      >
                        Get Policy Details
                      </button>
                      
                      <button
                        onClick={async () => {
                          if (policyId) {
                            const isInPool = await verifyPolicyInPool(policyId);
                            alert(`Policy ${policyId} in correct pool: ${isInPool}`);
                          } else {
                            alert('Please enter a policy ID first');
                          }
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                      >
                        Verify in Pool
                      </button>
                      
                      <button
                        onClick={async () => {
                          const policyId = prompt('Enter policy ID to check:');
                          if (policyId) {
                            await checkPolicyInPoolTable(policyId);
                            alert('Policy check complete. Check console for results.');
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Check Policy Object
                      </button>
                      
                      <button
                        onClick={async () => {
                          const policyId = prompt('Enter policy ID to check in pool table:');
                          if (policyId) {
                            await checkPolicyInPoolTable(policyId);
                            alert('Pool table check complete. Check console for results.');
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                      >
                        Check Policy in Pool Table
                      </button>
                      
                      <button
                        onClick={async () => {
                          await getDetailedPoolInfo();
                          alert('Detailed pool analysis complete. Check console for results.');
                        }}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                      >
                        Detailed Pool Analysis
                      </button>
                      
                      <button
                        onClick={async () => {
                          await getPoolTableInfo();
                          alert('Pool table analysis complete. Check console for results.');
                        }}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                      >
                        Pool Table Analysis
                      </button>
                      
                      <button
                        onClick={async () => {
                          await debugPolicyCreation();
                          alert('Policy creation debugging complete. Check console for results.');
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                      >
                        Debug Policy Creation
                      </button>
                      
                      <button
                        onClick={async () => {
                          await verifyPoolAccess();
                        }}
                        className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors"
                      >
                        Verify Pool Access
                      </button>
                      
                      <button
                        onClick={async () => {
                          await deployNewContract();
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Deploy New Contract
                      </button>
                      
                      <button
                        onClick={async () => {
                          await cleanupCorruptedPolicies();
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        Cleanup Corrupted Policies
                      </button>
                      
                      <button
                        onClick={async () => {
                          await autoCleanupCorruptedPolicies();
                          alert('Auto-cleanup complete. Check console for results.');
                        }}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                      >
                        Auto-Cleanup
                      </button>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">Add Funds to Pool</h4>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-sm text-gray-300 mb-2">
                          Current pool balance: {poolBalance ? `${(poolBalance / 1_000_000_000).toFixed(2)} SUI` : 'Loading...'}
                        </p>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            placeholder="Amount in SUI"
                            step="0.1"
                            min="0.1"
                            className="flex-1 px-3 py-2 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                            onChange={(e) => setFundAmount(e.target.value)}
                          />
                          <button
                            onClick={() => addFundsToPool(fundAmount)}
                            disabled={loading || !fundAmount || parseFloat(fundAmount) <= 0}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                          >
                            Add Funds
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Message */}
            {message && (
              <div className="mt-8 p-6 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 max-w-2xl mx-auto">
                <div className="flex items-center">
                  {message.includes('successfully') || message.includes('approved') ? (
                    <CheckCircle className="w-6 h-6 text-green-400 mr-3" />
                  ) : message.includes('Error') || message.includes('rejected') ? (
                    <XCircle className="w-6 h-6 text-red-400 mr-3" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3"></div>
                  )}
                  <p className="text-white">{message}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 max-w-md mx-auto border border-white/20">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <Shield className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-4">Connect Your Wallet</h2>
              <p className="text-gray-300 mb-8">
                Connect your Sui wallet to start creating flight insurance policies
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-16 text-gray-400">
          <p className="text-lg">Built on Sui Testnet • Flight Delay Insurance</p>
          <p className="text-sm mt-2">
            Package ID: {PACKAGE_ID.substring(0, 10)}...{PACKAGE_ID.substring(PACKAGE_ID.length - 8)}
          </p>
          <p className="text-xs mt-1 text-gray-500">
            Pool ID: {INSURANCE_POOL_ID.substring(0, 8)}...{INSURANCE_POOL_ID.substring(INSURANCE_POOL_ID.length - 6)}
          </p>
        </div>
      </div>
    </div>
  )
}

export default App 