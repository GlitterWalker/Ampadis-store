# Ampadi's Store

Plain HTML/CSS/JS frontend + zero-dependency Node backend.

## Run locally
    node server.js        # http://localhost:3000

## API
- GET  /api/products
- GET  /api/info
- POST /api/orders   body: {"items":[{"id":"kb-01","qty":2}]}  -> {orderId,status,items,total}
- GET  /health

## Deploy on EC2
1. Launch EC2: Amazon Linux 2023, t3.micro. Security Group inbound: 22 (your IP), 80 (0.0.0.0/0).
2. From your machine:
       scp -i key.pem ampadis-store.zip ec2-user@<PUBLIC_IP>:~
       ssh -i key.pem ec2-user@<PUBLIC_IP>
3. On the instance:
       sudo dnf install -y unzip      # Ubuntu: sudo apt install -y unzip  (user is "ubuntu")
       unzip ampadis-store.zip && cd ampadis-store
       sudo bash deploy/ec2-setup.sh
4. Open http://<PUBLIC_IP>/

Logs: `journalctl -u ampadis-store -f` · Restart: `sudo systemctl restart ampadis-store`
Orders are appended to /opt/ampadis-store/orders.jsonl
Set badge color: `sudo DEPLOY_COLOR=green bash deploy/ec2-setup.sh`
