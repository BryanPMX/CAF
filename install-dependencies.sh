# Install missing dependencies for CAF Admin Portal
# Run this script to ensure all required dependencies are installed

echo "Installing missing dependencies for CAF Admin Portal..."

# Navigate to admin-portal directory
cd admin-portal

# Install js-cookie and its types
npm install js-cookie @types/js-cookie

# Run type check to ensure everything is working
npm run type-check

# Run lint to check for any issues
npm run lint

echo "Dependencies installed successfully!"
echo "You can now run 'npm run dev' to start the development server."
