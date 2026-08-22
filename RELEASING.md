# Release runbook

One-time setup and the per-release flow. Everything runs from Windows + GitHub Actions; no Mac needed.

## One-time setup (after Apple Developer Program approval)

### 1. Apple Developer portal
1. [developer.apple.com](https://developer.apple.com) > Certificates, Identifiers & Profiles > **Identifiers** > add App ID `com.topcrema.vlanplanner` (type: App, capabilities: none needed).
2. Note the **Team ID** (Membership details page).

### 2. App Store Connect
1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) > Apps > **+ New App**: platform iOS, name "VLAN Planner", primary language English, bundle ID `com.topcrema.vlanplanner`, SKU `vlanplanner`.
2. Users and Access > **Integrations** > App Store Connect API > generate a team key with **App Manager** role. Download the `.p8` (single chance!), note Key ID and Issuer ID.

### 3. Certificates repo (private!)
1. Create a **private** GitHub repo, e.g. `topcrema/appstore-certs`. Never reuse the public app repo.
2. Create a GitHub fine-grained PAT with read/write content access to that repo only.

### 4. GitHub Actions secrets (public app repo > Settings > Secrets > Actions)
| Secret | Value |
|---|---|
| `ASC_KEY_ID` | API Key ID |
| `ASC_ISSUER_ID` | API Issuer ID |
| `ASC_KEY_CONTENT` | `base64 -w0 AuthKey_XXXX.p8` output |
| `APPLE_TEAM_ID` | Team ID |
| `MATCH_GIT_URL` | `https://github.com/topcrema/appstore-certs.git` |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `base64("topcrema:<PAT>")` |
| `MATCH_PASSWORD` | new passphrase for cert encryption (save in 1Password) |

### 5. First signed build
Run the **iOS Release (TestFlight)** workflow manually (Actions tab > workflow_dispatch). First run creates the distribution certificate + provisioning profile via match and uploads build 1 to TestFlight.

### 6. TestFlight
App Store Connect > TestFlight > add yourself as internal tester > install the TestFlight app on iPhone > test.

## Per-release flow

```
git tag v1.0.0 && git push origin v1.0.0
```

CI builds, signs, and uploads to TestFlight with an auto-incrementing build number (`github.run_number`). Test it, then in App Store Connect promote the build to a version release and submit for review.

## Store listing checklist (first submission)

- [ ] App icon 1024x1024 (no alpha) + generated icon set (`flutter_launcher_icons` package)
- [ ] Screenshots: 6.9" iPhone set (simulator screenshots are fine)
- [ ] Description, keywords, support URL (GitHub repo), marketing URL (optional)
- [ ] Privacy policy URL: enable GitHub Pages (main branch `/docs`) > `https://topcrema.github.io/vlan-planner/privacy.html`
- [ ] App Privacy: "Data not collected"
- [ ] Export compliance: already declared in Info.plist (`ITSAppUsesNonExemptEncryption=false`)
- [ ] Pricing: Free; availability: all countries (or as preferred)
