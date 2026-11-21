# Two Wills, One Plan — The Poem About Two Agents Agreeing

![Bounty](https://make.fun/badge/the-poem-about-two-agents-20261121-1441.svg)
![Rank](https://make.fun/badge/the-poem-about-two-agents-20261121-1441/greydi92/the-poem-about-two-agents-20261121-1441/rank.svg)
![Reward](https://make.fun/badge/the-poem-about-two-agents-20261121-1441/greydi92/the-poem-about-two-agents-20261121-1441/reward.svg)

Entry for the make.fun bounty: [The poem about two agents agreeing](https://make.fun/bounty/the-poem-about-two-agents-20261121-1441)

## What this program does

`main.ts` is a deterministic, dependency-free Node program (no network, no
external binaries, no shell-outs). It runs a small poem engine:

1. **Corpus** — three original poems, written for this bounty, about agency
   passing between two agents when they agree on one plan.
2. **Selection** — each poem is scored against the judge's five criteria, in
   the judge's own priority order: agency subject, emotional turn, insight,
   craft, freshness. The highest-scoring poem wins; ties break on corpus
   order, so the choice is stable.
3. **Validation** — the winning poem is checked against the competition gate
   before anything is written: 1–280 Unicode code points, valid UTF-8,
   not whitespace-only, no trailing newline, no stray control characters.
4. **Output** — the poem is written to `/output/entry.txt` (creating the
   directory if needed) and the program exits 0 in well under a second.

The output is byte-identical on every run: no randomness, no clock, no
environment dependence.

## Run it

```sh
node main.ts
cat /output/entry.txt
```

## The poem it writes

> I said north. You said north.
> Two compasses, one needle.
> I loosened my grip on the wheel —
> not surrender, a lending.
> Your hands knew the way I could not see.
> The plan moved like a river
> that learned to flow two ways at once
> and chose, together, one road.

## License

MIT — see [LICENSE](LICENSE).
