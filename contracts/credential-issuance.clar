;; Credential Issuance Contract
;; This contract issues verifiable government attestations

(define-data-var admin principal tx-sender)

;; Data structures
(define-map credentials
  {
    citizen-id: (string-ascii 20),
    credential-type: (string-ascii 30)
  }
  {
    issuer: principal,
    issue-date: uint,
    expiry-date: uint,
    credential-hash: (buff 32),
    revoked: bool
  }
)

(define-map authorized-issuers
  { issuer: principal }
  {
    can-issue: bool,
    credential-types: (list 10 (string-ascii 30))
  }
)

;; Read-only functions
(define-read-only (get-credential
    (citizen-id (string-ascii 20))
    (credential-type (string-ascii 30))
  )
  (default-to
    {
      issuer: tx-sender,
      issue-date: u0,
      expiry-date: u0,
      credential-hash: 0x,
      revoked: true
    }
    (map-get? credentials { citizen-id: citizen-id, credential-type: credential-type })
  )
)

(define-read-only (is-credential-valid
    (citizen-id (string-ascii 20))
    (credential-type (string-ascii 30))
  )
  (let (
    (credential (get-credential citizen-id credential-type))
  )
    (and
      (not (get revoked credential))
      (< block-height (get expiry-date credential))
    )
  )
)

(define-read-only (is-authorized-issuer (issuer principal) (credential-type (string-ascii 30)))
  (let (
    (issuer-info (default-to { can-issue: false, credential-types: (list) }
                 (map-get? authorized-issuers { issuer: issuer })))
  )
    (and
      (get can-issue issuer-info)
      (is-some (index-of (get credential-types issuer-info) credential-type))
    )
  )
)

(define-read-only (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions
(define-public (issue-credential
    (citizen-id (string-ascii 20))
    (credential-type (string-ascii 30))
    (expiry-date uint)
    (credential-hash (buff 32))
  )
  (begin
    (asserts! (is-authorized-issuer tx-sender credential-type) (err u401))
    (ok (map-set credentials
      { citizen-id: citizen-id, credential-type: credential-type }
      {
        issuer: tx-sender,
        issue-date: block-height,
        expiry-date: expiry-date,
        credential-hash: credential-hash,
        revoked: false
      }
    ))
  )
)

(define-public (revoke-credential
    (citizen-id (string-ascii 20))
    (credential-type (string-ascii 30))
  )
  (let (
    (credential (get-credential citizen-id credential-type))
  )
    (begin
      (asserts! (or (is-eq tx-sender (get issuer credential)) (is-admin)) (err u403))
      (ok (map-set credentials
        { citizen-id: citizen-id, credential-type: credential-type }
        (merge credential { revoked: true })
      ))
    )
  )
)

(define-public (add-authorized-issuer
    (issuer principal)
    (credential-types (list 10 (string-ascii 30)))
  )
  (begin
    (asserts! (is-admin) (err u403))
    (ok (map-set authorized-issuers
      { issuer: issuer }
      { can-issue: true, credential-types: credential-types }
    ))
  )
)

(define-public (remove-authorized-issuer (issuer principal))
  (begin
    (asserts! (is-admin) (err u403))
    (ok (map-set authorized-issuers
      { issuer: issuer }
      { can-issue: false, credential-types: (list) }
    ))
  )
)

(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err u403))
    (ok (var-set admin new-admin))
  )
)

