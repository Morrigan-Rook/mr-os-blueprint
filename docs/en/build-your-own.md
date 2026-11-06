# Build your own

A practical order of work for building a system like MR OS for your organization. It assumes a small team and a clear service. Each step produces something you can use before the next one starts.

## 1. Write the method before the software

Agents can only apply criteria that are written precisely. Write down how you do the work: the steps, the scales, the thresholds, what counts as evidence, what a good deliverable contains and the checks before it goes out. If two of your people would score the same case differently, the method isn't ready for agents yet.

**Done when:** a new person could apply the method from the document alone.

## 2. List the seats

Write the roles file: every human and agent seat, its supervisor, what it does, what it never does, and its status. Include the seats you haven't filled. Give agents human-sounding names and a clear AI label.

**Done when:** for every task in your method, you can point to the seat that owns it and the person who approves it.

## 3. Decide what a person must approve

Go through every output that can reach a client, a prospect or a third party. Each one gets an approval step. Decide what a rejection note must say.

## 4. Turn the rules that matter into gates

For each rule whose breach would hurt a client or the firm, write a gate that refuses to save, send or run, and returns a reason. Start with: evidence for high scores, client data only after the account is formally opened, outbound messages with opt-out and without unsourced figures, and no agent claiming to be human.

## 5. Define task types

For each agent task: the input, the instruction, the output format (JSON when a machine reads it), how to validate it, and whether it needs approval. Keep instructions in versioned files, one per agent, and keep the method in shared files.

## 6. Choose engines with your eyes open

Decide which engine runs which level of work, under which access mode and terms. Isolate every run: allowlisted environment, empty working folder, timeout. Set daily caps. Run one task at a time until you have a reason not to.

## 7. Build the approval surface

A queue where people see candidates, approve them as they are, approve with corrections or reject with a note. Show the version and the engine on every output.

## 8. Version and evaluate

Record the agent version on every output. Keep an evaluation bank of closed cases and run it before changing an agent. Watch the correction rate per agent every month.

## 9. Set the rhythm

A daily brief, a weekly review against the plan (not against last week) and a quarterly review of the method, the risks and the agents. Let an agent prepare each one; let a person run it.

## 10. Security checklist

- Secrets are pasted into the app's settings by an administrator, never sent through chat or email, never committed.
- Two-factor authentication for every person.
- Access per role, removed the day someone leaves the role.
- Client data only in authorized tools, with data processing agreements in place.
- Agents can't change their own rules or permissions.
- An append-only audit log for decisions and gate blocks.

## What to measure from day one

- Correction rate per agent (healthy: about 10–25 %).
- Gate blocks per week, by gate (a gate that never fires may be checking the wrong thing).
- Time from a trigger (an application, a reply) to a person seeing the candidate.
- Share of outputs approved without changes, by agent version.
