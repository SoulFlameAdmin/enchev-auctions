# EAuctions by SoulFlame — UI Functional Parity

Status: STARTED
Baseline: production GHKk63 / commit e1617b42e272fa3f40f06d93178f6f48a4211043

## Non-negotiable rule
Preserve the current production functional core, data contracts, backend/API, authentication, auction/bidding logic, inventory, search/filtering, roles/admin, security and Supabase integration. Replace/refine the presentation layer only until parity is proven.

## Migration gates
1. Inventory + vehicle detail
2. Search, VIN/Lot search, filters and persisted filter state
3. Auction discovery, live auction state and bidding flows
4. Watchlist/favorites and user account flows
5. Bid history and relevant notifications/state
6. Admin/role flows
7. Backend/API/Supabase contract regression checks
8. Responsive mobile/tablet/desktop UI
9. Security/verification regression checks
10. Brand pass: EAuctions by SoulFlame

Every migrated feature must pass OLD -> NEW -> TEST -> GREEN before production promotion.

Production main remains untouched during migration.