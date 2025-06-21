import React, { useState, useEffect } from 'react'
import { ConnectButton, useWalletKit } from '@mysten/wallet-kit'
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import { Plane, Shield, Clock, DollarSign, FileText, Search, MapPin, Calendar, Users, TrendingUp, CheckCircle, XCircle } from 'lucide-react'

// Initialize Sui client for testnet
const client = new SuiClient({ url: getFullnodeUrl('testnet') })

// Contract configuration - using environment variables
const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x5ca97a7f3b2b9608848d234255cd34c50d6378d0155b9d779a68029b87fda700'
const INSURANCE_POOL_ID = import.meta.env.VITE_INSURANCE_POOL_ID || '0x48ee799b814ccbdfb178ce0e248a80879354e97ac7778d20ad5e9c0182eea90c'
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
      setMessage('Please connect your wallet first')
      return
    }

    if (!flightNumber || !airline || !departureTime || !coverageAmount || !premium) {
      setMessage('Please fill in all required fields')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const tx = new TransactionBlock()
      
      // Convert amounts to MIST (1 SUI = 1,000,000,000 MIST)
      const coverageAmountMist = Math.floor(parseFloat(coverageAmount) * 1_000_000_000)
      const premiumMist = Math.floor(parseFloat(premium) * 1_000_000_000)
      
      // Split coins for premium payment
      const [coin] = tx.splitCoins(tx.gas, [premiumMist])
      
      // Convert departure time to timestamp
      const departureTimestamp = Math.floor(new Date(departureTime).getTime() / 1000)
      
      // Call create_policy function
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::create_policy`,
        arguments: [
          tx.object(INSURANCE_POOL_ID), // insurance pool
          tx.pure(Array.from(new TextEncoder().encode(flightNumber)), 'vector<u8>'),
          tx.pure(Array.from(new TextEncoder().encode(airline)), 'vector<u8>'),
          tx.pure(departureTimestamp, 'u64'),
          tx.pure(coverageAmountMist, 'u64'),
          coin,
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

      console.log('Transaction result:', result)
      
      // Extract policy ID from events
      if (result.events) {
        const policyCreatedEvent = result.events.find(event => 
          event.type === `${PACKAGE_ID}::${MODULE_NAME}::PolicyCreated`
        )
        if (policyCreatedEvent && policyCreatedEvent.parsedJson) {
          const eventData = policyCreatedEvent.parsedJson as any
          const policyId = eventData.policy_id
          if (policyId) {
            setPolicyId(policyId)
            setMessage(`Policy created successfully! Policy ID: ${policyId}`)
          } else {
            setMessage('Policy created successfully!')
          }
        } else {
          setMessage('Policy created successfully!')
        }
      } else {
        setMessage('Policy created successfully!')
      }
      
      // Clear form
      setFlightNumber('')
      setAirline('')
      setDepartureTime('')
      setCoverageAmount('')
      setPremium('')
      setFlightData(null)
      
    } catch (error) {
      console.error('Error creating policy:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const processClaim = async () => {
    if (!currentAccount || !policyId || !delayMinutes) {
      setMessage('Please connect wallet, enter policy ID, and delay minutes')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const tx = new TransactionBlock()
      
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::process_claim`,
        arguments: [
          tx.object(INSURANCE_POOL_ID), // insurance pool
          tx.pure(policyId, '0x2::object::ID'),
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
            setMessage(`Claim approved! Payout: ${amount / 1_000_000_000} SUI`)
          } else {
            setMessage(`Claim rejected. Delay was ${delayMinutes} minutes, but threshold is 1440 minutes (24 hours)`)
          }
        } else {
          setMessage('Claim processed successfully!')
        }
      } else {
        setMessage('Claim processed successfully!')
      }
      
    } catch (error) {
      console.error('Error processing claim:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full mr-4 animate-float">
              <Plane className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Flight Insurance
            </h1>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded-full ml-4 animate-float" style={{ animationDelay: '1s' }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <p className="text-xl text-gray-300 mb-8">Decentralized flight delay insurance on Sui Testnet</p>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-blue-500/20 p-3 rounded-lg mr-4">
                  <Plane className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Active Policies</p>
                  <p className="text-2xl font-bold text-white">Live</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-green-500/20 p-3 rounded-lg mr-4">
                  <Shield className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Coverage</p>
                  <p className="text-2xl font-bold text-white">Up to 100 SUI</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-purple-500/20 p-3 rounded-lg mr-4">
                  <Clock className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Delay Threshold</p>
                  <p className="text-2xl font-bold text-white">24h</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 card-hover">
              <div className="flex items-center">
                <div className="bg-emerald-500/20 p-3 rounded-lg mr-4">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Network</p>
                  <p className="text-2xl font-bold text-white">Sui</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <ConnectButton />
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
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Process Claim
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
                    Search Real Flight Data
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Flight Number (IATA)
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={searchFlight}
                          onChange={(e) => setSearchFlight(e.target.value)}
                          placeholder="e.g., AA123"
                          className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                        />
                        <button
                          onClick={searchFlightData}
                          disabled={searchingFlight}
                          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-r-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {searchingFlight ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {flightData && (
                      <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-4 border border-blue-500/30">
                        <h3 className="text-lg font-semibold text-white mb-3">Flight Information</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Flight:</span>
                            <span className="text-white font-medium">{flightData.flight.number}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Airline:</span>
                            <span className="text-white font-medium">{flightData.airline.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">From:</span>
                            <span className="text-white font-medium">{flightData.departure.airport}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">To:</span>
                            <span className="text-white font-medium">{flightData.arrival.airport}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Status:</span>
                            <span className={`font-medium ${
                              flightData.status === 'active' ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                              {flightData.status}
                            </span>
                          </div>
                          {flightData.departure.delay > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-300">Delay:</span>
                              <span className="text-red-400 font-medium">{flightData.departure.delay} min</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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
                          onChange={(e) => setAirline(e.target.value)}
                          placeholder="e.g., American Airlines"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                        />
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
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 max-w-2xl mx-auto">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                  <FileText className="w-6 h-6 mr-3 text-green-400" />
                  Process Claim
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Policy ID
                    </label>
                    <input
                      type="text"
                      value={policyId}
                      onChange={(e) => setPolicyId(e.target.value)}
                      placeholder="Enter policy ID from created policy"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Delay Minutes
                    </label>
                    <input
                      type="number"
                      value={delayMinutes}
                      onChange={(e) => setDelayMinutes(e.target.value)}
                      placeholder="1440 (24 hours threshold)"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                    />
                    <p className="text-sm text-gray-400 mt-2">
                      Claims are approved for delays ≥ 1440 minutes (24 hours)
                    </p>
                  </div>

                  <button
                    onClick={processClaim}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium text-lg transition-all transform hover:scale-105"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    ) : (
                      <FileText className="w-6 h-6 mr-3" />
                    )}
                    Process Claim
                  </button>
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
        </div>
      </div>
    </div>
  )
}

export default App 