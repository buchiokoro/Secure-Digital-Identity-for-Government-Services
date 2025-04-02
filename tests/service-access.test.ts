import { describe, it, expect, beforeEach } from "vitest"

// Mock the Clarity contract interactions
const mockServiceAccess = {
  services: new Map(),
  serviceAccess: new Map(),
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  txSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  blockHeight: 100,
  
  registerService(serviceId, name, requiredCredentials) {
    if (this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.services.set(serviceId, {
      name,
      requiredCredentials,
      active: true,
      admin: this.txSender,
    })
    
    return { success: true }
  },
  
  updateServiceStatus(serviceId, active) {
    const service = this.services.get(serviceId)
    
    if (!service) {
      return { error: 404 }
    }
    
    if (service.admin !== this.txSender && this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.services.set(serviceId, {
      ...service,
      active,
    })
    
    return { success: true }
  },
  
  grantServiceAccess(citizenId, serviceId, expiryDate) {
    const service = this.services.get(serviceId)
    
    if (!service) {
      return { error: 404 }
    }
    
    if (service.admin !== this.txSender && this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    if (!service.active) {
      return { error: 404 }
    }
    
    const key = `${citizenId}-${serviceId}`
    this.serviceAccess.set(key, {
      granted: true,
      grantDate: this.blockHeight,
      expiryDate,
      grantedBy: this.txSender,
    })
    
    return { success: true }
  },
  
  revokeServiceAccess(citizenId, serviceId) {
    const service = this.services.get(serviceId)
    
    if (!service) {
      return { error: 404 }
    }
    
    if (service.admin !== this.txSender && this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    const key = `${citizenId}-${serviceId}`
    const access = this.serviceAccess.get(key)
    
    if (!access) {
      return { error: 404 }
    }
    
    this.serviceAccess.set(key, {
      ...access,
      granted: false,
    })
    
    return { success: true }
  },
  
  getService(serviceId) {
    return (
        this.services.get(serviceId) || {
          name: "",
          requiredCredentials: [],
          active: false,
          admin: this.txSender,
        }
    )
  },
  
  getAccessStatus(citizenId, serviceId) {
    const key = `${citizenId}-${serviceId}`
    return (
        this.serviceAccess.get(key) || {
          granted: false,
          grantDate: 0,
          expiryDate: 0,
          grantedBy: this.txSender,
        }
    )
  },
  
  canAccessService(citizenId, serviceId) {
    const service = this.getService(serviceId)
    const access = this.getAccessStatus(citizenId, serviceId)
    
    return service.active && access.granted && this.blockHeight < access.expiryDate
  },
  
  transferServiceAdmin(serviceId, newAdmin) {
    const service = this.services.get(serviceId)
    
    if (!service) {
      return { error: 404 }
    }
    
    if (service.admin !== this.txSender && this.txSender !== this.admin) {
      return { error: 403 }
    }
    
    this.services.set(serviceId, {
      ...service,
      admin: newAdmin,
    })
    
    return { success: true }
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

describe("Service Access Contract", () => {
  beforeEach(() => {
    // Reset the mock state
    mockServiceAccess.services = new Map()
    mockServiceAccess.serviceAccess = new Map()
    mockServiceAccess.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockServiceAccess.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockServiceAccess.blockHeight = 100
  })
  
  it("should register a service successfully when called by admin", () => {
    const result = mockServiceAccess.registerService("TAX_FILING", "Tax Filing Service", ["NATIONAL_ID", "TAX_ID"])
    
    expect(result.success).toBe(true)
    
    const service = mockServiceAccess.getService("TAX_FILING")
    expect(service.name).toBe("Tax Filing Service")
    expect(service.active).toBe(true)
  })
  
  it("should fail to register a service when called by non-admin", () => {
    mockServiceAccess.setTxSender("ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB")
    
    const result = mockServiceAccess.registerService("TAX_FILING", "Tax Filing Service", ["NATIONAL_ID", "TAX_ID"])
    
    expect(result.error).toBe(403)
  })
  
  it("should grant service access successfully", () => {
    // First register a service
    mockServiceAccess.registerService("TAX_FILING", "Tax Filing Service", ["NATIONAL_ID", "TAX_ID"])
    
    // Then grant access
    const result = mockServiceAccess.grantServiceAccess(
        "CITIZEN123",
        "TAX_FILING",
        500, // expiry date
    )
    
    expect(result.success).toBe(true)
    
    const access = mockServiceAccess.getAccessStatus("CITIZEN123", "TAX_FILING")
    expect(access.granted).toBe(true)
    expect(access.expiryDate).toBe(500)
  })
  
  it("should check if a citizen can access a service", () => {
    // First register a service
    mockServiceAccess.registerService("TAX_FILING", "Tax Filing Service", ["NATIONAL_ID", "TAX_ID"])
    
    // Then grant access
    mockServiceAccess.grantServiceAccess(
        "CITIZEN123",
        "TAX_FILING",
        500, // expiry date
    )
    
    // Check access
    let canAccess = mockServiceAccess.canAccessService("CITIZEN123", "TAX_FILING")
    expect(canAccess).toBe(true)
    
    // Advance block height past expiry
    mockServiceAccess.advanceBlockHeight(401) // now at block 501
    
    // Should no longer have access
    canAccess = mockServiceAccess.canAccessService("CITIZEN123", "TAX_FILING")
    expect(canAccess).toBe(false)
  })
  
  it("should revoke service access successfully", () => {
    // First register a service
    mockServiceAccess.registerService("TAX_FILING", "Tax Filing Service", ["NATIONAL_ID", "TAX_ID"])
    
    // Then grant access
    mockServiceAccess.grantServiceAccess("CITIZEN123", "TAX_FILING", 500)
    
    // Then revoke access
    const result = mockServiceAccess.revokeServiceAccess("CITIZEN123", "TAX_FILING")
    expect(result.success).toBe(true)
    
    const access = mockServiceAccess.getAccessStatus("CITIZEN123", "TAX_FILING")
    expect(access.granted).toBe(false)
    
    // Should no longer have access
    const canAccess = mockServiceAccess.canAccessService("CITIZEN123", "TAX_FILING")
    expect(canAccess).toBe(false)
  })
})

