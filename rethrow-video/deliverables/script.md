# Rethrow overview v3: narration script

Voice: Chatterbox (open-source neural TTS), male, cloned from a synthetic reference voice

## 0:00 · What is vibe coding?

In February 2025, AI researcher and OpenAI co-founder Andrej Karpathy gave a name to a new way of building software: vibe coding. Merriam-Webster now defines it as the practice of using an artificial intelligence system to generate computer code. Describe what you want in plain language, and watch a working app take shape in hours, instead of months.

## 0:22 · The rise of vibe coding

And vibe coding is no longer a niche experiment. Around 90% of developers now use AI coding tools. Roughly 41% of new code is AI-generated. About 63% of people building with these tools have no professional background in software engineering. In Y Combinator's Winter 2025 batch, a quarter of startups ran on codebases that were roughly 95% AI-generated. Tens of millions of AI-built apps now exist, and the pace is accelerating.

## 0:51 · The vibe coding cliff

But building a first version and running a production system are two very different things. There's a wide gap between a prototype that demos well, and a workload that can run in production. We call it the vibe coding cliff: the moment the excitement of watching your app take shape gives way to the feeling that the ground has dropped out from under you.

## 1:10 · Beyond the demo

Suddenly, you face questions that never mattered in a demo. Who owns the infrastructure, and where does the source code live? How is the app deployed, and how do you roll back? How do you control networking, identity, encryption, and access? What happens when traffic spikes, or you hit a platform rate limit? And what happens if you want to leave the platform you started on? The stakes are real. By some measures, close to half of AI-generated code fails basic security testing.

## 1:38 · Three paths to production

Today, a builder who outgrows a vibe coding platform has two options. Do it yourself, and spend weeks or months learning cloud, DevOps, and security. Or hire a developer, and take on the cost of hiring, scoping, and managing the work. Rethrow is building a third path.

## 1:53 · Why the name Rethrow?

Rethrow is named after a programming concept. When software hits an error, code can catch it, handle it, and rethrow it, so it keeps moving forward instead of silently failing. Your app is the same. When it outgrows the prototype, you don't throw it away. You catch it, and rethrow it onto dedicated cloud infrastructure. Our mission is simple: build fast, and own what comes next.

## 2:16 · Rethrow bridges the gap

Rethrow bridges the vibe coding cliff. Move beyond vibe coding, without becoming a cloud engineer. At launch, there will be two ways to use Rethrow: migrate an existing app, or build something new.

## 2:28 · Migrate an existing app

To migrate, connect an app built on a platform like Lovable, Replit, or Base44, through GitHub. Rethrow's migration agents assess your app, understand its architecture, and design a target environment on your preferred cloud. Then they write a spec-driven plan, refactor what needs to change, deploy, and validate the result, while your original app stays untouched. The goal: turn a highly manual cloud migration into a repeatable, agent-orchestrated workflow, completed in under an hour. Migrations will be a one-time price of $500.

## 3:00 · One spec at a time

Behind the scenes, agents work one spec at a time. Each spec is a single, logical unit of work, with its own requirements, design, and tasks. The agent writes code, deploys, and verifies its work before moving on. If a check fails, it retries, and escalates to a human when needed.

## 3:19 · Build in Rethrow Studio

To build, there's Rethrow Studio. Keep developing after a migration, or start something completely new, in a browser interface that feels like the vibe coding you know. Prompt, preview, iterate, and publish, while your app runs in a dedicated cloud environment and source repository you control. Switch between Vibe and Spec modes, inspect your code and your cloud, and ship through a fully managed deployment pipeline. Getting started will be simple. Connect your coding agent with an API key or OAuth, and Studio runs on the agent subscription you already have. Migrations, development, and infrastructure operations, all from one interface. Have more than one subscription? Bring multiple agent harnesses into the same workspace, and switch between them as you work. Studio will be $50 per user, per month.

## 3:47 · Multi-harness control plane

Under the hood, Rethrow Studio runs on a multi-harness control plane. Most AI development tools sit on top of an agent harness: the runtime that gives a model access to files, repositories, commands, and tools. With Rethrow, you bring your own agent: Claude Code, Codex, Cursor, Gemini CLI, Factory Droid, Goose, Kiro, and more. Rethrow uses emerging agent protocols, like the Agent Client Protocol, CLI streaming, and the Model Context Protocol, to create one uniform experience, no matter which provider you bring. Rethrow should remain consistent, even when the underlying agent changes. It manages every workflow, from migrations and development to infrastructure operations, across Amazon Web Services, Google Cloud, Microsoft Azure, and Oracle Cloud Infrastructure.

## 4:33 · Six guiding principles

We're building Rethrow around six guiding principles. The first five make an application production-ready. The sixth keeps it portable, and ready for whatever comes next. One: Ownership. Everything Rethrow produces belongs to you, in a dedicated cloud environment and source repository within your control. Two: Structure. Version-controlled source, infrastructure as code, repeatable pipelines, and a spec-driven workflow, all managed for you. Three: Scalability. Cost-efficient, serverless-first architecture by default, so you pay for real usage, with room to evolve as you grow. Four: Security. Managed identity, network boundaries, encryption, least-privilege permissions, and logs you can audit, as a default, not an upgrade. Five: Reliability. Managed pipelines, automated validation, and clean rollbacks, so deployments are fast, boring, and repeatable. And six: Extensibility. Multi-source, multi-target, and multi-harness, so you have a choice at every major boundary.

## 5:30 · Multi-user, multi-app workspaces

At launch, Rethrow will also support multi-user, multi-app workspaces. Bring your whole team, and manage every app, migration, and build from one place.

## 5:40 · Who it's for

Whether you're a non-technical founder, an enterprise innovation team, or an agency delivering client apps, Rethrow is your path from prototype to durable software.

## 5:51 · Meet the founder

Rethrow was founded by Dustin Ellis, a former Amazon Web Services Senior Solutions Architect, and an Amazon Web Services Developer Ambassador. After presenting at re:Invent in December 2025, he left to build full-time. In 2026, the company pivoted to agent-orchestrated migrations, completed the Launchpad Tech Ventures summer accelerator, joined Launchpad Ignite, and rebranded from Vibe2Cloud to Rethrow.

## 6:16 · Launch, pricing & waitlist

Rethrow is targeting general availability at the start of 2027, with early users onboarding before then. If you're a software reseller, startup community, or development agency, we'd love to talk about early access and volume-based pricing. Pricing, features, and agent availability are all subject to change before launch. Until then, our team is heads-down, building the best possible experience for you. Build fast, and own what comes next. Join the waitlist at rethrow.ai.

