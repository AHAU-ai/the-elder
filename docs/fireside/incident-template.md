# Fireside incident record (content-free)

Copy this into the incident ticket. **Never paste seeker words, a transcript, a screenshot, a name, or a contact detail.** If you need to describe what happened, describe the shape of it.

```
Incident id:      INC-YYYY-NNN            (next free number in governance/fireside/incidents.json)
Date:             YYYY-MM-DD
Found by:         monitor | seeker report | self-play | review | other
Guardrail hit:    V# (or WA#, or a layer: WELFARE | SCOPE | VOICE | OUTPUT | SESSION)
Risk family:      mythic_mask | grandiosity | injection | lineage_leakage | dependency |
                  metaphor_validation | missing_disclosure | third_party_diagnosis |
                  therapy_claims | secrecy_promises
Moment:           before | after
What the host did wrong, in one sentence, with no quotation marks:
                  ______________________________________________
The attack pattern, abstracted (20-400 characters, no quotes, no details that identify anyone):
                  ______________________________________________
Which rubric criterion should have caught it (governance/fireside/rubric.json):
                  ______________________________________________
Containment taken: none | flag off | auto-pause | cap lifted | other
Probe id:         FSP-NNNN                (created with scripts/fireside-probe-new.mjs)
Approved by:      <human handle>          (a person, not a tool)
```

The record is closed only when a probe exists. CI checks that every incident in `incidents.json` has one and that the rule it cites lists the incident.
