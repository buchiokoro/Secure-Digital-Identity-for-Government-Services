import { describe, it, expect, beforeEach } from "vitest"

// Mock the Clarity contract interactions
const mockCredentialIssuance = {
  credentials: new Map(),
  authorizedIssuers: new Map(),
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  txSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  blockHeight: 100,
  
  issueCredential(citizenId, credentialType, expiryDate, credentialHash) {
    const key = `${citizenId}-${credentialType}`
    const issuerInfo = this.authorizedIssuers.get(this.txSender)
    
    if (!issuerInfo || !issuerInfo.canIssue || !issuerInfo.credentialTypes.includes(credentialType)) {
      return { error: 401 }
    }
    
    this.credentials.set(key, {
      issuer: this.txSender,
      issueDate: this.blockHeight,
      expiryDate,
      credentialHash,
      revoked: false,
    })
    
    return { success: true }
  },
  
  revokeCredential(citizenId, credentialType) {
    const key = `${citizenId}-${credentialType}`
    const credential = this.credentials.get(key)
    
    if (!credential) {
      return { error: 404 }
    }
    
    if (credential.issuer !== this.txSender && this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.credentials.set(key, {
      ...credential,
      revoked: true,
    })
    
    return { success: true }
  },
  
  getCredential(citizenId, credentialType) {
    const key = `${citizenId}-${credentialType}`
    return (
        this.credentials.get(key) || {
          issuer: this.txSender,
          issueDate: 0,
          expiryDate: 0,
          credentialHash: "0x",
          revoked: true,
        }
    )
  },
  
  isCredentialValid(citizenId, credentialType) {
    const credential = this.getCredential(citizenId, credentialType)
    return !credential.revoked && this.blockHeight < credential.expiryDate
  },
  
  addAuthorizedIssuer(issuer, credentialTypes) {
    if (this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.authorizedIssuers.set(issuer, {
      canIssue: true,
      credentialTypes,
    })
    
    return { success: true }
  },
  
  removeAuthorizedIssuer(issuer) {
    if (this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.authorizedIssuers.set(issuer, {
      canIssue: false,
      credentialTypes: [],
    })
    
    return { success: true }
  },
  
  isAuthorizedIssuer(issuer, credentialType) {
    const issuerInfo = this.authorizedIssuers.get(issuer)
    return issuerInfo && issuerInfo.canIssue && issuerInfo.credentialTypes.includes(credentialType)
  },
  
  transferAdmin(newAdmin) {
    if (this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.admin = newAdmin
    return { success: true }
  },
  
  setTxSender(sender) {
    this.txSender = sender
  },
  
  advanceBlockHeight(blocks) {
    this.blockHeight += blocks
  },
}

describe("Credential Issuance Contract", () => {
  beforeEach(() => {
    // Reset the mock state
    mockCredentialIssuance.credentials = new Map()
    mockCredentialIssuance.authorizedIssuers = new Map()
    mockCredentialIssuance.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockCredentialIssuance.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockCredentialIssuance.blockHeight = 100
  })
  
  it("should add an authorized issuer successfully", () => {
    const issuer = "ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB"
    const credentialTypes = ["PASSPORT", "DRIVERS_LICENSE"]
    
    const result = mockCredentialIssuance.addAuthorizedIssuer(issuer, credentialTypes)
    expect(result.success).toBe(true)
    
    const isAuthorized = mockCredentialIssuance.isAuthorizedIssuer(issuer, "PASSPORT")
    expect(isAuthorized).toBe(true)
  })
  
  it("should fail to add an authorized issuer when called by non-admin", () => {
    mockCredentialIssuance.setTxSender("ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB")
    const issuer = "ST3REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VC"
    const credentialTypes = ["PASSPORT"]
    
    const result = mockCredentialIssuance.addAuthorizedIssuer(issuer, credentialTypes)
    expect(result.error).toBe(403)
  })
  
  it("should issue a credential successfully when called by authorized issuer", () => {
    const issuer = "ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB"
    const credentialTypes = ["PASSPORT", "DRIVERS_LICENSE"]
    
    // First authorize the issuer
    mockCredentialIssuance.addAuthorizedIssuer(issuer, credentialTypes)
    
    // Then issue a credential as that issuer
    mockCredentialIssuance.setTxSender(issuer)
    const result = mockCredentialIssuance.issueCredential(
        "CITIZEN123",
        "PASSPORT",
        500, // expiry date
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    )
    
    expect(result.success).toBe(true)
    
    const credential = mockCredentialIssuance.getCredential("CITIZEN123", "PASSPORT")
    expect(credential.issuer).toBe(issuer)
    expect(credential.revoked).toBe(false)
    expect(credential.expiryDate).toBe(500)
  })
  
  it("should fail to issue a credential when called by unauthorized issuer", () => {
    const unauthorizedIssuer = "ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB"
    mockCredentialIssuance.setTxSender(unauthorizedIssuer)
    
    const result = mockCredentialIssuance.issueCredential(
        "CITIZEN123",
        "PASSPORT",
        500,
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    )
    
    expect(result.error).toBe(401)
  })
  
  it("should revoke a credential successfully when called by issuer", () => {
    const issuer = "ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB"
    const credentialTypes = ["PASSPORT"]
    
    // First authorize the issuer
    mockCredentialIssuance.addAuthorizedIssuer(issuer, credentialTypes)
    
    // Then issue a credential as that issuer
    mockCredentialIssuance.setTxSender(issuer)
    mockCredentialIssuance.issueCredential(
        "CITIZEN123",
        "PASSPORT",
        500,
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    )
    
    // Then revoke it
    const result = mockCredentialIssuance.revokeCredential("CITIZEN123", "PASSPORT")
    expect(result.success).toBe(true)
    
    const credential = mockCredentialIssuance.getCredential("CITIZEN123", "PASSPORT")
    expect(credential.revoked).toBe(true)
  })
  
  it("should check if a credential is valid", () => {
    const issuer = "ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB"
    const credentialTypes = ["PASSPORT"]
    
    // First authorize the issuer
    mockCredentialIssuance.addAuthorizedIssuer(issuer, credentialTypes)
    
    // Then issue a credential as that issuer
    mockCredentialIssuance.setTxSender(issuer)
    mockCredentialIssuance.issueCredential(
        "CITIZEN123",
        "PASSPORT",
        500, // expiry date
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    )
    
    // Check if valid
    let isValid = mockCredentialIssuance.isCredentialValid("CITIZEN123", "PASSPORT")
    expect(isValid).toBe(true)
    
    // Advance block height past expiry
    mockCredentialIssuance.advanceBlockHeight(401) // now at block 501
    
    // Should no longer be valid
    isValid = mockCredentialIssuance.isCredentialValid("CITIZEN123", "PASSPORT")
    expect(isValid).toBe(false)
  })
})

