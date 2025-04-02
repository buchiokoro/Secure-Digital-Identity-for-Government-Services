;; Service Access Contract
;; This contract manages permissions for different government systems

(define-data-var admin principal tx-sender)

;; Data structures
(define-map services
  { service-id: (string-ascii 30) }
  {
    name: (string-ascii 50),
    required-credentials: (list 5 (string-ascii 30)),
    active: bool,
    admin: principal
  }
)

(define-map service-access
  {
    citizen-id: (string-ascii 20),
    service-id: (string-ascii 30)
  }
  {
    granted: bool,
    grant-date: uint,
    expiry-date: uint,
    granted-by: principal
  }
)

;; Read-only functions
(define-read-only (get-service (service-id (string-ascii 30)))
  (default-to
    { name: "", required-credentials: (list), active: false, admin: tx-sender }
    (map-get? services { service-id: service-id })
  )
)

(define-read-only (get-access-status
    (citizen-id (string-ascii 20))
    (service-id (string-ascii 30))
  )
  (default-to
    { granted: false, grant-date: u0, expiry-date: u0, granted-by: tx-sender }
    (map-get? service-access { citizen-id: citizen-id, service-id: service-id })
  )
)

(define-read-only (can-access-service
    (citizen-id (string-ascii 20))
    (service-id (string-ascii 30))
  )
  (let (
    (access-info (get-access-status citizen-id service-id))
    (service-info (get-service service-id))
  )
    (and
      (get active service-info)
      (get granted access-info)
      (< block-height (get expiry-date access-info))
    )
  )
)

(define-read-only (is-service-admin (service-id (string-ascii 30)))
  (is-eq tx-sender (get admin (get-service service-id)))
)

(define-read-only (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions
(define-public (register-service
    (service-id (string-ascii 30))
    (name (string-ascii 50))
    (required-credentials (list 5 (string-ascii 30)))
  )
  (begin
    (asserts! (is-admin) (err u403))
    (ok (map-set services
      { service-id: service-id }
      {
        name: name,
        required-credentials: required-credentials,
        active: true,
        admin: tx-sender
      }
    ))
  )
)

(define-public (update-service-status (service-id (string-ascii 30)) (active bool))
  (let (
    (service-info (get-service service-id))
  )
    (begin
      (asserts! (or (is-eq tx-sender (get admin service-info)) (is-admin)) (err u403))
      (ok (map-set services
        { service-id: service-id }
        (merge service-info { active: active })
      ))
    )
  )
)

(define-public (grant-service-access
    (citizen-id (string-ascii 20))
    (service-id (string-ascii 30))
    (expiry-date uint)
  )
  (let (
    (service-info (get-service service-id))
  )
    (begin
      (asserts! (or (is-eq tx-sender (get admin service-info)) (is-admin)) (err u403))
      (asserts! (get active service-info) (err u404))
      (ok (map-set service-access
        { citizen-id: citizen-id, service-id: service-id }
        {
          granted: true,
          grant-date: block-height,
          expiry-date: expiry-date,
          granted-by: tx-sender
        }
      ))
    )
  )
)

(define-public (revoke-service-access
    (citizen-id (string-ascii 20))
    (service-id (string-ascii 30))
  )
  (let (
    (service-info (get-service service-id))
    (access-info (get-access-status citizen-id service-id))
  )
    (begin
      (asserts! (or (is-eq tx-sender (get admin service-info)) (is-admin)) (err u403))
      (ok (map-set service-access
        { citizen-id: citizen-id, service-id: service-id }
        (merge access-info { granted: false })
      ))
    )
  )
)

(define-public (transfer-service-admin
    (service-id (string-ascii 30))
    (new-admin principal)
  )
  (let (
    (service-info (get-service service-id))
  )
    (begin
      (asserts! (or (is-eq tx-sender (get admin service-info)) (is-admin)) (err u403))
      (ok (map-set services
        { service-id: service-id }
        (merge service-info { admin: new-admin })
      ))
    )
  )
)

(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err u403))
    (ok (var-set admin new-admin))
  )
)

