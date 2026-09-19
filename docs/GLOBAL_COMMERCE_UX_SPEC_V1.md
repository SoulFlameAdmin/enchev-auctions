# ENCHEV AUCTIONS — GLOBAL COMMERCE UX SPEC V1

Status: ACTIVE / MANDATORY UNDER DESIGN PROCESS 2
Owner: ENCHEV DESIGN / DAVID
Applies to: all public, buyer, seller, support, logistics, legal, admin and system-state UI
Related: docs/DESIGN_PROCESS_2.md, locales/translation-keys.json, packages/config/src/country-profile.ts

## 1. Non-negotiable product law

ENCHEV is being designed as an international vehicle-auction and cross-border commerce platform.

No DP2 task may be considered complete if its screen still contains:
- visible hardcoded user-facing text outside the translation system;
- a user action without an explicit action/state definition;
- a currency, number, date, time, timezone, unit or country rule formatted ad hoc;
- country-specific behavior hardcoded directly into presentation code;
- mobile-only or desktop-only functionality without an intentional alternate flow;
- an unhandled loading, empty, success, warning, validation, permission, offline, reconnect or error state;
- a critical action without keyboard/focus/touch accessibility;
- an irreversible or financial/legal action without clear confirmation/context.

The architecture must support arbitrary BCP-47 locales. A locale can be activated for production only when its required catalog passes completeness checks. Locale formatting must use Unicode/CLDR-compatible rules. Currency codes use ISO 4217. Country identifiers use ISO 3166. Timezones use IANA identifiers.

## 2. Global shell — required controls on applicable screens

Every applicable screen must explicitly define these controls and their responsive behavior:

- ENCHEV logo / Home
- Browse vehicles
- Auctions
- Live auctions
- Auction calendar
- Results
- Search
- Saved searches
- Watchlist
- Compare vehicles
- Notifications
- Messages
- Support
- Transport
- Vehicle history
- Language
- Country / market
- Display currency
- Measurement units
- Timezone display preference
- Accessibility preferences
- Sign in
- Register
- Account
- Sign out
- Mobile menu open
- Mobile menu close
- Breadcrumb back / parent navigation
- Skip to content
- Cookie/privacy controls where applicable

Global selectors must never silently alter contractual values. Display currency and display units are presentation preferences unless the underlying commercial record explicitly states otherwise.

## 3. Global locale and language behavior

The UI architecture must support:
- locale auto-detection with explicit user override;
- native language names in the language selector;
- search/filter inside the language selector;
- remembered user locale;
- guest locale persistence;
- locale-specific pluralization;
- grammatical variants where required;
- locale-specific number separators;
- locale-specific currency placement and minor units;
- locale-specific date formats;
- locale-specific time formats;
- locale-specific week start;
- locale-specific relative-time formatting;
- locale-specific sorting/collation;
- right-to-left layout capability for Arabic/Hebrew-class locales;
- mixed RTL/LTR values such as VINs, registration numbers, currencies and phone numbers;
- translated validation messages;
- translated accessibility labels;
- translated email/SMS/push templates;
- translated PDF/document UI labels where ENCHEV owns the document;
- fallback chain when a translation is missing;
- hard failure in certification when an active production locale has missing required strings.

Target language coverage must be extensible beyond a fixed list. Initial international catalogs should prioritize:
English, Bulgarian, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Romanian, Greek, Turkish, Ukrainian, Russian, Arabic, Hebrew, Simplified Chinese, Traditional Chinese, Japanese, Korean, Hindi, Urdu, Vietnamese, Thai, Indonesian, Malay, Czech, Slovak, Hungarian, Croatian, Serbian, Slovenian, Lithuanian, Latvian, Estonian, Swedish, Danish, Norwegian and Finnish.

This list is a launch-priority set, not an architectural limit.

## 4. Global formatting and market controls

Required presentation preferences:
- language / locale;
- country / market;
- display currency;
- distance unit: km / mi;
- speed unit: km/h / mph where applicable;
- fuel economy format where applicable;
- temperature unit where applicable;
- weight unit: kg / lb;
- dimension unit: mm/cm/m or in/ft;
- volume unit: L / gal where applicable;
- timezone;
- 12h / 24h time where locale/user preference permits;
- date presentation;
- decimal/grouping conventions.

Every monetary value must retain:
- original transactional currency;
- display currency when conversion is shown;
- conversion timestamp/source metadata when relevant;
- clear distinction between exact amount and estimate.

## 5. Public route registry

Required routes / screens:

- Home
- Vehicle inventory
- Search results
- Vehicle detail
- Auctions index
- Auction calendar
- Auction detail
- Live auctions index
- Live auction room
- Auction results
- Vehicle categories
- Makes
- Models
- Locations / yards
- Location detail
- How it works
- Buying guide
- Selling guide when seller functionality is enabled
- Transport overview
- Vehicle history
- Support center
- Contact
- FAQ
- About ENCHEV
- Why ENCHEV
- News / articles
- Article detail
- Terms
- Privacy
- Cookies
- Accessibility statement
- Country/market availability page
- Legal/eligibility notice page where a market requires one.

## 6. Authentication and onboarding controls

Required screens/actions:
- Sign in
- Register
- Continue with supported identity provider if enabled
- Email
- Phone
- Password
- Show password
- Hide password
- Remember me
- Accept Terms
- Accept Privacy notice
- Marketing consent where lawful and optional
- Create account
- Verify email
- Resend verification
- Verify phone
- Resend OTP
- Change phone/email
- Forgot password
- Reset password
- Back to sign in
- Log out other sessions
- Identity verification start
- Identity verification continue
- Identity verification retry
- Business account option
- Individual account option
- Country of residence / establishment
- Company details
- Tax/VAT identifiers where applicable
- EORI field where applicable
- Address
- Billing/contact address where applicable
- Preferred language
- Preferred currency
- Preferred timezone
- Preferred units
- Notification consent/preferences.

Every onboarding field needs: label, helper text, validation state, invalid state, server-error state, loading state, accessibility description and translation key.

## 7. Inventory/search — exact control families

Search controls:
- free-text search;
- VIN search;
- lot number search;
- make;
- model;
- generation/series where data exists;
- year from/to;
- vehicle category/body type;
- fuel/energy type;
- transmission;
- drivetrain;
- engine;
- displacement;
- power;
- mileage/odometer min/max;
- odometer unit;
- exterior color;
- interior color where available;
- keys present;
- starts/runs condition;
- primary damage;
- secondary damage;
- title/document type;
- sale/auction status;
- auction date/time;
- seller;
- yard/location;
- origin country;
- destination eligibility where known;
- current bid range;
- Buy Now availability;
- transport availability;
- vehicle-history availability;
- image/video availability;
- newly listed;
- ending soon;
- watched only;
- saved-search criteria.

Search actions:
- Search
- Apply filters
- Clear all
- Reset one filter
- Remove active filter chip
- Expand filter group
- Collapse filter group
- Show more values
- Show fewer values
- Save search
- Rename saved search
- Delete saved search
- Enable saved-search alerts
- Disable alerts
- Sort
- Grid view
- List view
- Compact view if offered
- Previous page
- Next page
- First page
- Last page
- Page number
- Results per page
- Load more where used
- Retry search
- Share search.

Sort options should cover at minimum:
- relevance;
- newest;
- auction ending soon;
- auction starting soon;
- year newest/oldest;
- mileage low/high;
- current bid low/high;
- Buy Now low/high when available.

## 8. Vehicle card — required actions and states

Every vehicle card must define:
- open vehicle;
- watch;
- unwatch;
- compare;
- remove from compare;
- share;
- auction-status badge;
- location;
- sale date/time;
- current bid;
- Buy Now amount where available;
- bid count where appropriate;
- mileage/odometer;
- primary damage;
- document/title type;
- image count;
- live indicator;
- ending-soon indicator;
- sold indicator;
- reserved/withdrawn/unavailable indicator;
- transport availability indicator;
- loading skeleton;
- image unavailable state;
- restricted-market state;
- login-required state.

## 9. Vehicle detail — complete action registry

Media:
- previous image;
- next image;
- thumbnail select;
- open fullscreen;
- close fullscreen;
- zoom in;
- zoom out;
- reset zoom;
- rotate/360 where media exists;
- play video;
- pause video;
- mute/unmute;
- download/view permitted document;
- open damage image;
- report media issue.

Vehicle:
- watch/unwatch;
- compare/remove;
- share;
- copy link;
- print;
- report listing issue;
- translate seller/inspection notes where enabled;
- reveal full VIN where policy permits;
- copy VIN;
- view vehicle history;
- request support.

Auction:
- sign in to bid;
- register/verify to bid;
- place bid;
- select bid increment;
- enter custom bid;
- set max/proxy bid where supported;
- increase bid;
- confirm bid;
- cancel before submission;
- view bid history;
- join live auction;
- watch live;
- Buy Now where supported;
- confirm Buy Now;
- accept applicable auction terms;
- view auction rules;
- add auction reminder;
- remove reminder.

Logistics:
- get transport estimate;
- select origin;
- select destination country;
- select destination city/postcode;
- port/terminal selection where applicable;
- pickup option;
- delivery option;
- transport method;
- request transport quote;
- save quote;
- contact logistics support;
- view estimated customs/import requirements;
- view required documents;
- track shipment when purchased.

## 10. Live auction room — exact interactions

Controls/states:
- Join live room
- Leave room
- Reconnect
- Connection quality/status
- Live / delayed / reconnecting / stale state
- Server-authoritative countdown
- Current lot
- Current bid
- Bidder-leading state
- Outbid state
- Bid accepted state
- Bid rejected state
- Auction paused
- Auction resumed
- Sold
- No sale
- Passed
- Withdrawn
- Next lot
- Previous lot when permitted
- Queue
- Lot details
- Watch/unwatch
- Bid increment buttons
- Custom bid
- Max/proxy bid if supported
- Confirm bid
- Bid pending
- Cancel only before submission where technically possible
- Bid history
- Auction messages
- Sound on/off
- Fullscreen
- Picture-in-picture/popout only if intentionally supported
- Report live issue
- Contact support
- Network/offline notice
- Rejoin after authentication expiry
- Session-expired state.

No bid button may infer success from client state alone; accepted/rejected/leading status must come from authoritative auction state.

## 11. Buyer workspace

Dashboard:
- overview;
- watched vehicles;
- active bids;
- auctions today;
- won vehicles;
- documents requiring action;
- transport status;
- unread messages;
- notifications;
- account verification status.

Account routes:
- profile;
- personal/company identity;
- verification;
- addresses;
- preferences;
- watchlist;
- compare list;
- saved searches;
- bids;
- active auctions;
- won vehicles;
- purchase records;
- documents;
- transport;
- messages;
- notifications;
- support tickets;
- security;
- sessions/devices;
- privacy controls.

Actions include:
- edit;
- save;
- cancel;
- discard;
- upload;
- replace upload;
- delete where permitted;
- download;
- view;
- retry;
- archive;
- mark read/unread;
- enable/disable alert;
- change password;
- enable/disable MFA where supported;
- manage passkey where supported;
- sign out session;
- sign out all other sessions;
- export personal data where applicable;
- request account deletion where applicable and legally supported.

## 12. International logistics and customs UX

The platform must model, not guess:
- origin country;
- origin yard;
- destination country;
- destination address/port;
- pickup/delivery method;
- carrier;
- shipment method;
- estimated transit time;
- transport status;
- tracking references;
- export status;
- import status;
- customs-document status;
- inspection status where applicable;
- storage status;
- handover status;
- required-document checklist;
- EORI requirement where applicable;
- tariff/customs-code reference where applicable;
- duty/tax estimate clearly labeled as estimate when shown;
- destination restrictions;
- restricted/prohibited import state;
- missing-document state;
- customs hold;
- carrier delay;
- delivery complete.

Country-specific customs requirements must come from configurable market/compliance data, not UI hardcoding.

## 13. Seller / consignor workspace

When enabled:
- seller dashboard;
- create listing;
- save draft;
- VIN decode;
- manual vehicle details;
- upload photos;
- reorder photos;
- upload video;
- add damage points;
- add condition report;
- upload title/document;
- seller notes;
- auction selection;
- sale date selection;
- reserve configuration where business rules allow;
- preview listing;
- submit for review;
- edit returned listing;
- withdraw request;
- listing status;
- auction status;
- result;
- buyer/logistics handoff;
- seller messages/support.

## 14. Support and communication

Support actions:
- Search help
- Browse help category
- Open article
- Contact support
- Start ticket
- Add message
- Attach file
- Remove attachment
- Send
- Close ticket
- Reopen ticket where allowed
- Rate support
- Report technical issue
- Report listing issue
- Report auction issue
- Report accessibility issue
- Select language for support where available.

Communication channels must clearly show whether a message is email, SMS, push, in-app or live support.

## 15. Notifications

Notification categories:
- auction starting;
- auction reminder;
- bid accepted;
- leading;
- outbid;
- auction won;
- auction lost/ended;
- watched vehicle update;
- saved-search match;
- document required;
- verification required;
- verification completed/failed;
- transport quote/status;
- customs/document update;
- support reply;
- security alert;
- account/login alert;
- system/service notice.

Actions:
- open;
- mark read;
- mark unread;
- mark all read;
- notification settings;
- mute category;
- unmute category;
- delete/archive where supported.

## 16. Admin / operations

Admin must have role/permission-aware controls for:
- dashboard;
- vehicles;
- new/edit vehicle;
- media;
- documents;
- auction creation;
- auction schedule;
- live auction control;
- bid monitoring;
- results;
- users;
- individual/business verification;
- locations/yards;
- transport;
- customs/compliance configuration;
- support;
- content;
- localization;
- translation completeness;
- market/country profiles;
- notification templates;
- feature flags;
- audit log;
- system settings;
- incident/status controls.

Every admin mutation must define:
- permission;
- confirmation requirement;
- audit event;
- success/error state;
- reversible vs irreversible behavior.

## 17. Legal, eligibility and compliance UX

The UI must support configurable:
- Terms version acceptance;
- Privacy notice;
- Cookie controls;
- auction-specific rules acceptance;
- country/market eligibility;
- buyer type eligibility;
- identity/business verification;
- age/legal-capacity requirement where applicable;
- export/import restrictions;
- document requirements;
- tax/VAT identifiers where applicable;
- customs identifiers such as EORI where applicable;
- sanctions/restricted-party compliance hooks if required by the operating model;
- record of consent/acceptance version and timestamp.

Legal and tax outcomes must not be invented by the UI. They require jurisdiction-specific policy/configuration and legal/tax review.

## 18. System-state matrix

Every major page/action must support applicable:
- initial loading;
- skeleton;
- empty;
- no search results;
- partial data;
- stale data;
- offline;
- reconnecting;
- session expired;
- unauthenticated;
- unauthorized;
- forbidden by role;
- forbidden by country/market;
- verification required;
- document required;
- rate limited;
- validation error;
- server error;
- third-party unavailable;
- timeout;
- success;
- warning;
- destructive confirmation;
- irreversible confirmation;
- conflict / data changed;
- retry;
- maintenance;
- page not found.

## 19. Accessibility acceptance

Target WCAG 2.2 AA for the ENCHEV web experience.

Every interactive control must provide:
- keyboard access;
- visible focus;
- programmatic name;
- sufficient contrast;
- touch target appropriate for mobile;
- no essential color-only meaning;
- reduced-motion behavior where motion exists;
- zoom/reflow acceptance;
- screen-reader state announcement for important async changes;
- accessible errors and validation;
- logical heading/order;
- language metadata;
- correct directionality for RTL locales.

## 20. Translation-key law

Every user-visible label, button, menu item, status, filter, validation message, tooltip, modal title, modal action, empty state, toast, notification label, accessibility label and system message owned by ENCHEV must have a stable translation key.

Namespaces should include:
- common
- navigation
- auth
- home
- search
- inventory
- vehicle
- auction
- liveAuction
- account
- watchlist
- compare
- transport
- customs
- support
- notifications
- seller
- admin
- legal
- accessibility
- errors
- system

Translation keys are identifiers, never visible prose.

## 21. International standards / data boundaries

Use:
- BCP-47 style locale identifiers;
- Unicode CLDR-compatible locale data/formatting;
- ISO 3166 country codes;
- ISO 4217 currency codes;
- IANA timezone identifiers.

Customs/tariff integration must support jurisdiction-specific official data sources. For EU operations, TARIC and EORI requirements must be treated as external authoritative data/policy sources rather than hardcoded assumptions.

## 22. Design Process 2 binding

This spec does not create DP2-31.

Instead:
- DP2-01 audits every relevant screen against this spec.
- DP2-04 owns global shell selectors and responsive navigation.
- DP2-06/09/10/11/12 own global discovery controls.
- DP2-13/14/15/16 own vehicle-detail actions.
- DP2-17/18/19/20 own LIVE auction controls/states.
- DP2-21/22/23 own account/support/logistics consistency.
- DP2-24/25/26 own mobile/desktop/accessibility behavior.
- DP2-27 owns all loading/empty/error/success/offline states and copy.
- DP2-29 owns browser visual regression.
- DP2-30 cannot be GREEN until the applicable Global Commerce UX checklist is satisfied and active locales are complete.

## 23. Certification rule

A production screen is incomplete if any applicable control/state in this document is:
- missing;
- visually inconsistent;
- inaccessible;
- untranslated;
- incorrectly formatted for locale;
- missing permission rules;
- missing confirmation where required;
- missing error/loading/empty states;
- hardcoded to one country/currency/timezone/unit convention.

This document is the mandatory scope ceiling/floor for Design Process 2 unless the user explicitly expands or removes product scope.
