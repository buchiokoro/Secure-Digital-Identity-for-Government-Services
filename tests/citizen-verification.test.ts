import { describe, it, expect, beforeEach } from "vitest"

// Mock the Clarity contract interactions
const mockCitizenVerification = {
  citizens: new Map(),
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  txSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  blockHeight: 100,
  
  verifyCitizen(citizenId, verificationMethod) {
    if (this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.citizens.set(citizenId, {
      verified: true,
      verificationDate: this.blockHeight,
      verificationMethod,
      verificationAuthority: this.txSender,
    })
    
    return { success: true }
  },
  
  revokeVerification(citizenId) {
    if (this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    if (!this.citizens.has(citizenId)) {
      return { error: 404 }
    }
    
    this.citizens.set(citizenId, {
      verified: false,
      verificationDate: this.blockHeight,
      verificationMethod: "revoked",
      verificationAuthority: this.txSender,
    })
    
    return { success: true }
  },
  
  getCitizenVerificationStatus(citizenId) {
    return (
        this.citizens.get(citizenId) || {
          verified: false,
          verificationDate: 0,
          verificationMethod: "",
          verificationAuthority: this.txSender,
        }
    )
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

describe("Citizen Verification Contract", () => {
  beforeEach(() => {
    // Reset the mock state
    mockCitizenVerification.citizens = new Map()
    mockCitizenVerification.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockCitizenVerification.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockCitizenVerification.blockHeight = 100
  })
  
  it("should verify a citizen successfully when called by admin", () => {
    const result = mockCitizenVerification.verifyCitizen("CITIZEN123", "PASSPORT")
    expect(result.success).toBe(true)
    
    const status = mockCitizenVerification.getCitizenVerificationStatus("CITIZEN123")
    expect(status.verified).toBe(true)
    expect(status.verificationMethod).toBe("PASSPORT")
    expect(status.verificationDate).toBe(100)
  })
  
  it("should fail to verify a citizen when called by non-admin", () => {
    mockCitizenVerification.setTxSender("ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB")
    const result = mockCitizenVerification.verifyCitizen("CITIZEN123", "PASSPORT")
    expect(result.error).toBe(403)
  })
  
  it("should revoke verification successfully when called by admin", () => {
    // First verify
    mockCitizenVerification.verifyCitizen("CITIZEN123", "PASSPORT")
    
    // Then revoke
    const result = mockCitizenVerification.revokeVerification("CITIZEN123")
    expect(result.success).toBe(true)
    
    const status = mockCitizenVerification.getCitizenVerificationStatus("CITIZEN123")
    expect(status.verified).toBe(false)
    expect(status.verificationMethod).toBe("revoked")
  })
  
  it("should transfer admin successfully", () => {
    const newAdmin = "ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB"
    const result = mockCitizenVerification.transferAdmin(newAdmin)
    expect(result.success).toBe(true)
    expect(mockCitizenVerification.admin).toBe(newAdmin)
    
    // Original admin should no longer be able to verify citizens
    mockCitizenVerification.setTxSender("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    const verifyResult = mockCitizenVerification.verifyCitizen("CITIZEN123", "PASSPORT")
    expect(verifyResult.error).toBe(403)
    
    // New admin should be able to verify citizens
    mockCitizenVerification.setTxSender(newAdmin)
    const newVerifyResult = mockCitizenVerification.verifyCitizen("CITIZEN123", "PASSPORT")
    expect(newVerifyResult.success).toBe(true)
  })
})

