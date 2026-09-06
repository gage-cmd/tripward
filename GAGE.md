# Gage checklist — Tripward hard-cut

This repository can update in-repo strings and assume the new GitHub name. **Renaming the GitHub repository itself requires Gage.** The agent cannot do it (GitHub write/rename is outside this run).

## 1. Rename the GitHub repo

1. Open https://github.com/gage-cmd/fusecap
2. **Settings** (repo settings, not account settings)
3. **General**
4. **Repository name** → `tripward`
5. Confirm / **Rename**

Target: `https://github.com/gage-cmd/tripward`

After GitHub rename:

- `https://github.com/gage-cmd/fusecap` and `git clone https://github.com/gage-cmd/fusecap.git` **redirect** to the new name.
- Existing local clones keep working until someone changes `origin`. Optional: `git remote set-url origin https://github.com/gage-cmd/tripward.git`
- GitHub Pages, issue links, and security-advisory URLs that still say `fusecap` also redirect.
- npm / local package name is already `tripward` in this PR. There is no published npm package to rename.

What breaks if you **do not** rename: buyer clone URLs in SETUP / thanks.html 404 until the repo exists as `gage-cmd/tripward`.

## 2. Update the lander (`gage-cmd/tripward-site`)

After the GitHub rename (or in the same sitting), CoS / Gage:

1. Open the lander repo `gage-cmd/tripward-site`
2. Edit `thanks.html` (live page: https://tripward.dev/thanks.html)
3. Change any remaining `git clone https://github.com/gage-cmd/fusecap.git` to:

   ```bash
   git clone https://github.com/gage-cmd/tripward.git
   ```

4. Change any `/path/to/fusecap/` or `cd fusecap` leftovers to `/path/to/tripward/` / `cd tripward`
5. Publish GH Pages

In-repo drop-in (this repo): `docs/lander/thanks.snippet.html` already uses the Tripward clone URL. Copy that file over the live `thanks.html` if the lander is still a paste of the snippet.

## 3. What still says FuseCap (honest)

Buyers should not see these unless they open operator/law files:

| Still says fusecap | Why |
|--------------------|-----|
| `docs/FUSECAP_OPS_BRAIN.txt` | Historical law document. Filename and body keep the working name. Header now says the public name is Tripward. |
| Journal event type `fuse.tripped` | Sealed journal / receipt timeline format. Changing it would break replay of existing runs. |
| Env aliases `FUSECAP_HOME`, `FUSECAP_RUN_DIR`, `FUSECAP_RUN_ID`, `FUSECAP_STUB*` | Written **and** read so leftover Claude hooks from a FuseCap install still find the run. New names are `TRIPWARD_*`. |
| On-disk `.fusecap/` | **Read-compat only.** New installs write `.tripward/`. If `.fusecap/` already exists and `.tripward/` does not, Tripward uses the leftover directory (no copy, no data loss). |
| Old `receipt.json` field `fusecap_version` | New receipts write `tripward_version` only. Readers accept the old field. |
| `stripFuseCapHooks` / `FUSECAP_VERSION` | Internal deprecated aliases of `stripTripwardHooks` / `TRIPWARD_VERSION`. Not printed to buyers. |

Hard cut: `package.json` name is `tripward`. The only bin is `tripward`. There is **no** `fusecap` CLI alias on this release.
