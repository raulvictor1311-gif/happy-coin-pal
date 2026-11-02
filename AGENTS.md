<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Open Finance
- Keep provider-specific code behind the OpenFinanceProvider interface; an unimplemented production adapter must fail closed instead of calling guessed APIs.
- Persist imported snapshots and staging records separately; use authenticated atomic database functions for ownership checks, deduplication, consent changes and audit events.
- Account snapshots replace historical cash movement for selected imported accounts; exclude unselected accounts, internal transfers and unresolved duplicates from financial totals.
- Sandbox data is opt-in for consolidated calculations and must carry visible simulation labels wherever displayed.
