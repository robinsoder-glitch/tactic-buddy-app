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

## Planning UI
- Use DateField for scheduling dates and HomeGroundOption for team home-ground suggestions so booking and editing behave identically.
- Use TrainingContentPicker for direct event attachments and training-plan drafts; previewing is read-only and selection uses the existing persistence path.
