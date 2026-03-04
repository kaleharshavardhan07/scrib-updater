FROM node:20-bullseye-slim

# Install TeX Live and required packages
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Create the output directory to prevent write errors
RUN mkdir -p output && chmod 777 output

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
