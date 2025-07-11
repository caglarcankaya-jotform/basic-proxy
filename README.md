# basic-proxy
Very basic proxy for some server you can reach from your local but not from public by using your local as a proxy.

Uses [ngrok](https://ngrok.com/) to make your local public, and redirects your port to your private server.

# Prerequisites
- ngrok installed on your computer (you can run `brew install ngrok` in macOS) 
- a constant ngrok domain (can be obtained freely from ngrok)
- node
- any node package manager (npm, pnpm, yarn)

# Getting Started 
you can use any package manager you want (npm, pnpm, yarn)
- `touch .env`
- Enter your private server url and ngrok url to the .env file (see default.env for example)
- `pnpm i`

# Running the proxy
- `pnpm start`