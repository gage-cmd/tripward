# Gage checklist — Tripward hard-cut

Public clone URL in every new doc is:

```bash
git clone https://github.com/gage-cmd/tripward.git
```

Do **not** publish `github.com/gage-cmd/fusecap` as a clone path. GitHub redirects from the old name are an after-rename implementation detail, not a public URL.

This agent cannot rename the GitHub repository (write/rename is outside this run). Gage clicks Settings.

## 1. Rename the GitHub repo

The repo still exists as `gage-cmd/fusecap` until you rename it. Buyer docs already say `gage-cmd/tripward`.

1. Open the current repo Settings page (today: https://github.com/gage-cmd/fusecap/settings)
2. **General**
3. **Repository name** → `tripward`
4. Confirm / **Rename**

Target: `https://github.com/gage-cmd/tripward`

After that click, GitHub usually redirects the old name. **Do not document the old URL for buyers.** Point new clones, SETUP, thanks.html, and issue links at `gage-cmd/tripward` only.

Optional for your own checkout: `git remote set-url origin https://github.com/gage-cmd/tripward.git`

Until the Settings rename, `git clone https://github.com/gage-cmd/tripward.git` 404s. That is why this click is on the critical path.

## 2. Update the lander (`gage-cmd/tripward-site`)

1. Open the lander repo `gage-cmd/tripward-site`
2. Edit `thanks.html` (live: https://tripward.dev/thanks.html)
3. Clone block must be Tripward only:

   ```bash
   git clone https://github.com/gage-cmd/tripward.git
   cd tripward
   ```

4. No `/path/to/fusecap/`, no `cd fusecap`, no `fusecap.git`
5. Publish GH Pages

In-repo drop-in: `docs/lander/thanks.snippet.html` (already Tripward). Copy it over live `thanks.html` if the lander is still a paste of the snippet.

## 3. What still says FuseCap (not a public clone path)

| Leftover | Why |
|----------|-----|
| `docs/FUSECAP_OPS_BRAIN.txt` | Historical law. Header says public name is Tripward. |
| Journal event `fuse.tripped` | Existing journal/receipt format. |
| `FUSECAP_*` env vars | Leftover Claude hooks. New names are `TRIPWARD_*`. |
| Leftover `.fusecap/` dir | Read-compat only. New installs write `.tripward/`. |
| Old `receipt.json` `fusecap_version` | Readers accept it. New receipts write `tripward_version`. |
| `fusecap` bin | Temporary alias for existing installs. Docs and `--help` say `tripward` only. |
| `stripFuseCapHooks` / `FUSECAP_VERSION` | Internal deprecated aliases. |
