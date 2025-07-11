source .env

# check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok could not be found, please install it via https://ngrok.com/download"
    exit 1
fi

# check NGROK_URL is set
if [ -z "$NGROK_URL" ]; then
    echo "NGROK_URL is not set, please set it in the .env file"
    exit 1
fi

# start the app
node app.js &

# start ngrok
ngrok http $PORT --url=$NGROK_URL
