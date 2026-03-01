# Purpose of Falcon Dash

## What Falcon Dash is

Falcon Dash is an all-in-one control panel for AI agents deployed by Fredbot Hosting. It gives you a single place to manage projects, browse documents, schedule tasks, store passwords, and configure every aspect of your AI agent setup.

## The problem it solves

When you hire Fredbot Hosting to deploy AI agents for your business, those agents run on dedicated infrastructure managed for you. But you still need a way to actually manage their configuration. Without Falcon Dash, you would need technical knowledge of servers, terminals, and configuration files and cli to interact with your agents.

Falcon Dash eliminates that complexity. It provides a clean, intuitive web interface where you can do everything you need to adjust advanced settings — without ever touching a command line.

## Where it sits in the stack

```
You (the customer)
  |
  v
Falcon Dash  ----  your web dashboard (this project)
  |
  v
OpenClaw Gateway  ----  the agent runtime protocol
  |
  v
Your AI Agent(s)  ----  the agents doing work for you
```

Behind the scenes, **Fredbot Backend** manages the infrastructure: provisioning servers, deploying software, managing configurations, and monitoring health. You never interact with it directly — Falcon Dash is your window into all of it.

**OpenClaw** is the open-source platform that powers the agent runtime. It defines how agents communicate, what capabilities they have, and how the gateway protocol works. Falcon Dash is built to work with OpenClaw and adapts as the platform evolves.

## Design philosophy

You are both the user and the administrator. You can send a message to your agent and also configure domain-level settings. There is no separate admin panel — everything is in one place, accessible based on what you need to do.

Key principles:

- **Non-technical users first.** Every feature is designed so that someone without a technical background can use it. When advanced configuration is needed, it is presented clearly with sensible defaults.
- **Expose capabilities, maintain security.** Falcon Dash aims to make every feature of the OpenClaw platform accessible through the dashboard while enforcing the security model (device pairing, exec approvals, scoped permissions).
- **Real-time and responsive.** The dashboard maintains a live WebSocket connection to your agent's gateway. You see agent responses streaming in real time, get notified of pending approvals instantly, and can use the dashboard from your phone or desktop.

## Who it's for

Falcon Dash is built for business owners and operators who have hired Fredbot Hosting to deploy and manage AI agents. These customers range from solo entrepreneurs to small teams. They are not developers — they are people who want to use AI agents to get work done, and they need a reliable, intuitive interface to do so.
