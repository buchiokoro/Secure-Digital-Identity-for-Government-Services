;; Citizen Verification Contract
;; This contract validates citizen identity through official channels

(define-data-var admin principal tx-sender)

;; Data structures
(define-map citizens
  { citizen-id: (string-ascii 20) }
  {
    verified: bool,
    verification-date: uint,
    verification-method: (string-ascii 20),
    verification-authority: principal
  }
)

;; Read-only functions
(define-read-only (get-citizen-verification-status (citizen-id (string-ascii 20)))
  (default-to
    { verified: false, verification-date: u0, verification-method: "", verification-authority: tx-sender }
    (map-get? citizens { citizen-id: citizen-id })
  )
)

(define-read-only (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions
(define-public (verify-citizen
    (citizen-id (string-ascii 20))
    (verification-method (string-ascii 20))
  )
  (begin
    (asserts! (is-admin) (err u403))
    (ok (map-set citizens
      { citizen-id: citizen-id }
      {
        verified: true,
        verification-date: block-height,
        verification-method: verification-method,
        verification-authority: tx-sender
      }
    ))
  )
)

(define-public (revoke-verification (citizen-id (string-ascii 20)))
  (begin
    (asserts! (is-admin) (err u403))
    (ok (map-set citizens
      { citizen-id: citizen-id }
      {
        verified: false,
        verification-date: block-height,
        verification-method: "revoked",
        verification-authority: tx-sender
      }
    ))
  )
)

(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err u403))
    (ok (var-set admin new-admin))
  )
)

