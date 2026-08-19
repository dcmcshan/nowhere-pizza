# Going live on nowhere-pizza.com

The site currently deploys to the GitHub Pages default URL so it can be
reviewed while **nowhere-pizza.com still points at the old Wix site**.

`CNAME.pending` holds the custom domain. It is deliberately *not* named
`CNAME`: as soon as GitHub sees a real `CNAME` file it redirects the
`github.io` URL to the custom domain, which would bounce every reviewer to the
old Wix site until DNS moves.

## Cutover, in order

1. **Lower the TTL** on the existing DNS records to 300s, at least a day ahead.

2. **Point DNS at GitHub.** At your DNS provider, replace the Wix records:

   Apex (`nowhere-pizza.com`) — four A records:

   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

   `www` — one CNAME record to `dcmcshan.github.io`.

3. **Activate the domain in this repo:**

   ```bash
   git mv CNAME.pending CNAME && git commit -m "Point Pages at nowhere-pizza.com" && git push
   ```

4. In the repo's **Settings → Pages**, set the custom domain to
   `nowhere-pizza.com` and tick **Enforce HTTPS** once the certificate is
   issued (this can take up to an hour after DNS propagates).

5. **Check redirects.** Both `www.` and the apex should resolve, and the old
   Wix URLs should not 404 — see the redirect map below.


## Turn indexing back on

The preview is deliberately hidden from search engines so it can't be indexed
with provisional prices or compete with the live Wix site as duplicate
content. Two things to undo at cutover:

1. Remove the `PREVIEW-NOINDEX` block from the `<head>` of every page:

   ```bash
   perl -0pi -e 's{<!-- PREVIEW-NOINDEX.*?\n<meta name="robots" content="noindex, nofollow">\n}{}s' *.html
   ```

   (`404.html` keeps its own `noindex, follow` — that one is correct and
   should stay.)

2. Replace `robots.txt` with the allow-all block commented at the bottom of
   that file.

Canonical URLs and Open Graph URLs already point at `nowhere-pizza.com`, so
they need no change — they simply start resolving once DNS moves.

## Old Wix URLs to redirect

The old site's pages don't all map 1:1. GitHub Pages can't issue server-side
redirects, so these are handled by small stub pages if you want the old links
to keep working:

| Old Wix path | New path |
|---|---|
| `/games-1` | `/keystone.html` |
| `/games-2` | `/keystone.html` |
| `/copper` | `/copper.html` |
| `/menu` | `/menu.html` |
| `/join-us` | `/contact.html` |
| `/news` | `/events.html` |
| `/event-list` | `/events.html` |
| `/privacy-policy` | `/privacy.html` |

Stubs for these live in the repo root (`games-1.html` etc.) and issue a
`<meta http-equiv="refresh">` plus a canonical link so search engines follow.

## Don't forget

- Cancel the Wix subscription **only after** the new site is confirmed live.
- Re-submit the sitemap in Google Search Console.
- Update the link in both Instagram bios and both Facebook pages.
