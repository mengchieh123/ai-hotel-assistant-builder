#!/bin/bash
echo "🚀 Quick Production Test - Fixed Parameters"
echo "=========================================="

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

# Test 1: Health Check
echo ""
echo "1. Health Check:"
curl -s "$BASE_URL/health" | jq '.'

# Test 2: State Machine (不會 400)
echo ""
echo "2. State Machine - Chinese:"
curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "我想訂房", "sessionId": "quick-test-001"}' | jq '.response, .state'

# Test 3: State Machine - English  
echo ""
echo "3. State Machine - English:"
curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "book room", "sessionId": "quick-test-002"}' | jq '.response, .state'

# Test 4: Traditional API - Fixed
echo ""
echo "4. Traditional API - Fixed Parameters:"
curl -s -X POST "$BASE_URL/api/booking" \
  -H "Content-Type: application/json" \
  -d '{
    "checkInDate": "2025-02-14",
    "nights": 1,
    "roomType": "豪華雙人房",
    "guestCount": 2,
    "guestName": "測試用戶"
  }' | jq '.'

# Test 5: Session Stats
echo ""
echo "5. Session Statistics:"
curl -s "$BASE_URL/api/sessions/stats" | jq '.'

echo ""
echo "✅ Quick test completed!"
