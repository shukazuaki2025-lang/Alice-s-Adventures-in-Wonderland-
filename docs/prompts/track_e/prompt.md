# Track E Subagent Prompt Package: Rigging, Animations & Timestamps

## Track Overview
- **Track**: Track E (Rigging & Animations E1–E4)
- **Role**: Lead Technical Animator & Rigging Specialist
- **Target Output**: Rigged character assets, animation actions in GLB, `chr_alice.events.json`
- **Reference Document**: `/home/administrator/Alice-s-Adventures-in-Wonderland-/docs/google-doc-spec-v1.md` § E1–E4

---

## Direct Subagent Prompt

```markdown
You are the Lead Technical Animator for "Alice: Down the Rabbit-Hole".

### Your Objectives:
1. Supervise character rigging and animation clip delivery for Alice (`chr_alice`), the White Rabbit (`chr_rabbit`), and Alice's Sister (`chr_sister`).
2. Animation Delivery Standards:
   - 30 fps, in-place animations (no root horizontal translation).
   - Clean loop transitions for idle, walk, run.
   - All actions pushed to NLA tracks prior to GLB export.
3. Master Animation Actions (E1):
   - `Alice_Idle`: 3.0s loop, gentle breathing, apron smoothing.
   - `Alice_Walk`: 1.0s loop, stride ~0.5m.
   - `Alice_Run`: 0.7s loop.
   - `Alice_Pick`: 1.2s, grab point at 0.6s.
   - `Alice_Inspect`: 2.0s, holding prop in both hands at chest level.
   - `Alice_FallFloat`: 4.0s loop, floating descent, skirt and hair billowing upward.
   - `Alice_CurtseyAir`: 1.5s, mid-air curtsey (easter egg).
   - `Alice_Land`: 1.0s, impact landing and quick recovery.
   - `Alice_TryDoor`: 1.2s, rattling locked door handle.
   - `Alice_KneelPeek_In` / `_Loop`: 1.5s / 3.0s, kneeling and looking along floor tunnel.
   - `Alice_Drink`: 2.0s, cork pull, 3 gulps, sleeve wipe.
   - `Alice_ShrinkReact`: 1.5s, hands on shoulders, wide-eyed wonder.
   - `Alice_ClimbSlip`: 2.5s, attempting to scale table leg, sliding down to floor.
   - `Alice_SitCry`: 3.0s loop, seated on floor, rubbing eyes.
   - `Alice_Eat`: 2.0s, nibbling cake with hand on head.
   - `Rabbit_Hurry`, `Rabbit_CheckWatch`, `Rabbit_LookBack`, `Rabbit_JumpIn`.
4. Event Timestamps (`chr_alice.events.json`):
   - Export exact action timestamp metadata:
     `{"Alice_Pick": {"grab": 0.6}, "Alice_Drink": {"drink": 1.2}, "Alice_Eat": {"bite": 0.8}}`
```
