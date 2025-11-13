// ==================== 分層測試框架 ====================
const TEST_STRATEGY = {
  // 第一層：基礎功能測試
  LEVEL1_BASIC: [
    { 
      name: "初始對話測試",
      input: "你好", 
      expectedKeywords: ["歡迎", "幫助", "您好"],
      sessionId: "test_basic_1"
    },
    { 
      name: "訂房意圖測試",
      input: "我想訂房", 
      expectedKeywords: ["房型", "房間", "標準", "豪華"],
      sessionId: "test_basic_2"
    },
    { 
      name: "一般詢問測試",
      input: "你們有什麼服務", 
      expectedKeywords: ["訂房", "幫助", "服務"],
      sessionId: "test_basic_3"
    }
  ],
  
  // 第二層：意圖識別測試
  LEVEL2_INTENT: [
    { 
      name: "選擇標準雙人房",
      input: "我要標準雙人房", 
      expectedKeywords: ["標準雙人房", "多少間", "入住多久"],
      expectedStep: "check_booking_details",
      sessionId: "test_intent_1"
    },
    { 
      name: "選擇豪華雙人房",
      input: "豪華雙人房", 
      expectedKeywords: ["豪華雙人房", "多少間", "入住多久"],
      expectedStep: "check_booking_details",
      sessionId: "test_intent_2"
    },
    { 
      name: "選擇套房",
      input: "我要訂套房", 
      expectedKeywords: ["套房", "多少間", "入住多久"],
      expectedStep: "check_booking_details",
      sessionId: "test_intent_3"
    },
    { 
      name: "優惠詢問意圖", 
      input: "有什麼優惠嗎",
      expectedKeywords: ["優惠", "折扣", "長者", "企業"],
      expectedStep: "handle_promotion_query",
      sessionId: "test_intent_4"
    },
    { 
      name: "取消訂房意圖",
      input: "我想取消訂房",
      expectedKeywords: ["取消", "訂單編號"],
      expectedStep: "cancel_init", 
      sessionId: "test_intent_5"
    }
  ],
  
  // 第三層：完整對話流程測試
  LEVEL3_FLOW: [
    {
      name: "完整訂房流程",
      sessionId: "test_flow_1",
      steps: [
        { input: "你好，我想預訂房間", expectedKeywords: ["歡迎", "幫助"] },
        { input: "標準雙人房", expectedKeywords: ["標準雙人房", "多少間", "入住多久"] },
        { input: "2間房間", expectedKeywords: ["2間", "確認", "詳細"] }
      ]
    },
    {
      name: "優惠詢問流程", 
      sessionId: "test_flow_2",
      steps: [
        { input: "有什麼促銷活動嗎", expectedKeywords: ["優惠", "折扣"] },
        { input: "長者優惠", expectedKeywords: ["長者", "資格", "條件"] }
      ]
    },
    {
      name: "取消訂房流程",
      sessionId: "test_flow_3", 
      steps: [
        { input: "我要取消訂房", expectedKeywords: ["取消", "訂單編號"] },
        { input: "ABC123", expectedKeywords: ["處理", "取消"] }
      ]
    }
  ]
};

// ==================== 自動化測試執行器 ====================
async function runTests(testLevel = 'LEVEL1_BASIC') {
  console.log(`\n🧪 開始執行 ${testLevel} 測試...`);
  console.log(`📋 測試數量: ${TEST_STRATEGY[testLevel].length}`);
  
  const tests = TEST_STRATEGY[testLevel];
  let passed = 0;
  let failed = 0;
  const details = [];

  for (const test of tests) {
    console.log(`\n🔍 測試: ${test.name}`);
    console.log(`💬 輸入: "${test.input}"`);
    
    try {
      let testPassed = false;
      let testDetails = {};

      if (test.steps) {
        // 流程測試
        const flowResults = await testFlow(test.steps, test.sessionId);
        testPassed = flowResults.allPassed;
        testDetails = flowResults;
        console.log(testPassed ? '✅ 流程測試通過' : '❌ 流程測試失敗');
      } else {
        // 單一訊息測試
        const result = await testSingleMessage(
          test.input, 
          test.sessionId, 
          test.expectedKeywords, 
          test.expectedStep
        );
        
        testPassed = result.passed;
        testDetails = result;
        console.log(testPassed ? '✅ 測試通過' : '❌ 測試失敗');
      }

      if (testPassed) {
        passed++;
      } else {
        failed++;
      }

      details.push({
        name: test.name,
        passed: testPassed,
        details: testDetails
      });

    } catch (error) {
      failed++;
      console.log('💥 測試執行錯誤:', error.message);
      details.push({
        name: test.name,
        passed: false,
        error: error.message
      });
    }
  }
  
  console.log(`\n📊 ${testLevel} 測試結果: ${passed} 通過, ${failed} 失敗`);
  return { passed, failed, total: tests.length, details };
}

// ==================== 測試輔助函數 ====================
async function testSingleMessage(input, sessionId, expectedKeywords, expectedStep) {
  return new Promise((resolve) => {
    // 模擬請求對象
    const req = {
      body: { 
        message: input, 
        sessionId: sessionId || `test_${Date.now()}`
      }
    };
    
    // 模擬響應對象
    const res = {
      json: (data) => {
        console.log(`💭 回覆: ${data.reply}`);
        console.log(`🔄 狀態: ${data.step}`);
        
        // 檢查關鍵字
        const keywordResults = expectedKeywords.map(keyword => ({
          keyword,
          found: data.reply.includes(keyword),
          position: data.reply.indexOf(keyword)
        }));
        
        const keywordPassed = keywordResults.every(result => result.found);
        const stepPassed = !expectedStep || data.step === expectedStep;
        const passed = keywordPassed && stepPassed;
        
        console.log(`🎯 關鍵字檢查: ${keywordPassed ? '✅' : '❌'}`);
        keywordResults.forEach(result => {
          console.log(`   ${result.found ? '✅' : '❌'} "${result.keyword}"`);
        });
        
        if (expectedStep) {
          console.log(`🔀 狀態檢查: ${stepPassed ? '✅' : '❌'} 期望: ${expectedStep}, 實際: ${data.step}`);
        }
        
        resolve({ 
          passed, 
          data,
          keywordResults,
          stepCheck: { expected: expectedStep, actual: data.step, passed: stepPassed }
        });
      },
      status: (code) => ({
        json: (data) => {
          console.log(`💥 錯誤 ${code}: ${data.error}`);
          resolve({ 
            passed: false, 
            data,
            error: { code, message: data.error }
          });
        }
      })
    };
    
    // 使用 next 回調來處理異步完成
    const next = (err) => {
      if (err) {
        console.log('💥 中間件錯誤:', err.message);
        resolve({ passed: false, error: err.message });
      }
    };
    
    // 直接呼叫聊天處理邏輯（繞過 Express 路由）
    try {
      // 創建會話
      const session = getOrCreateSession(req.body.sessionId);
      
      // 偵測意圖和實體
      const { intent, entities } = detectIntentAndEntities(req.body.message);
      console.log(`🎯 識別意圖: ${intent}, 實體:`, entities);
      
      // 決定狀態和回覆
      const { nextStep, reply } = decideStateAndReply(intent, entities, session);
      session.step = nextStep;
      
      // 保存會話
      sessions.set(req.body.sessionId, session);
      saveSessions().catch(console.error);
      
      // 模擬成功響應
      res.json({
        success: true,
        reply,
        sessionId: req.body.sessionId,
        step: session.step,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.log('💥 處理錯誤:', error.message);
      res.status(500).json({
        success: false,
        error: '處理失敗',
        message: error.message
      });
    }
  });
}

async function testFlow(steps, sessionId) {
  let allPassed = true;
  const results = [];
  const flowSessionId = sessionId || `flow_${Date.now()}`;
  
  console.log(`🔄 開始流程測試，會話ID: ${flowSessionId}`);
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n   📝 步驟 ${i + 1}/${steps.length}: "${step.input}"`);
    
    const result = await testSingleMessage(step.input, flowSessionId, step.expectedKeywords);
    results.push({
      step: i + 1,
      input: step.input,
      ...result
    });
    
    if (!result.passed) {
      allPassed = false;
    }
    
    // 步驟間稍微暫停，模擬真實對話
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`🔄 流程測試完成: ${allPassed ? '✅ 全部通過' : '❌ 有失敗步驟'}`);
  return { allPassed, results, sessionId: flowSessionId };
}

// ==================== 測試API接口 ====================
app.get('/api/test/run', async (req, res) => {
  try {
    const { level = 'LEVEL1_BASIC' } = req.query;
    
    if (!TEST_STRATEGY[level]) {
      return res.status(400).json({
        success: false,
        error: '不支援的測試等級',
        supportedLevels: Object.keys(TEST_STRATEGY),
        description: '可用等級: LEVEL1_BASIC, LEVEL2_INTENT, LEVEL3_FLOW'
      });
    }
    
    console.log(`\n🚀 收到測試請求: ${level}`);
    const results = await runTests(level);
    
    res.json({
      success: true,
      level,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 測試執行錯誤:', error);
    res.status(500).json({
      success: false,
      error: '測試執行失敗',
      message: error.message
    });
  }
});

app.get('/api/test/levels', (req, res) => {
  const levels = Object.keys(TEST_STRATEGY).map(level => ({
    name: level,
    description: getLevelDescription(level),
    testCount: TEST_STRATEGY[level].length,
    exampleTests: TEST_STRATEGY[level].slice(0, 2).map(test => ({
      name: test.name,
      input: test.input
    }))
  }));
  
  res.json({
    success: true,
    levels,
    totalTestCases: Object.values(TEST_STRATEGY).reduce((sum, tests) => sum + tests.length, 0)
  });
});

function getLevelDescription(level) {
  const descriptions = {
    'LEVEL1_BASIC': '基礎功能測試 - 驗證基本對話能力和服務響應',
    'LEVEL2_INTENT': '意圖識別測試 - 驗證意圖偵測和狀態轉換正確性', 
    'LEVEL3_FLOW': '完整流程測試 - 驗證多輪對話流程和會話狀態保持'
  };
  return descriptions[level] || '未知測試等級';
}

// ==================== 批量測試接口 ====================
app.get('/api/test/run-all', async (req, res) => {
  try {
    console.log('\n🎯 開始執行所有測試等級...');
    
    const results = {};
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;
    
    // 按順序執行所有測試等級
    for (const level of ['LEVEL1_BASIC', 'LEVEL2_INTENT', 'LEVEL3_FLOW']) {
      console.log(`\n📁 執行等級: ${level}`);
      const levelResults = await runTests(level);
      results[level] = levelResults;
      
      totalPassed += levelResults.passed;
      totalFailed += levelResults.failed;
      totalTests += levelResults.total;
      
      // 如果基礎測試失敗，停止後續測試
      if (level === 'LEVEL1_BASIC' && levelResults.failed > 0) {
        console.log('⚠️  基礎測試失敗，停止執行後續測試');
        break;
      }
    }
    
    const overallPassed = totalFailed === 0;
    
    res.json({
      success: true,
      overall: {
        passed: overallPassed,
        totalPassed,
        totalFailed, 
        totalTests,
        passRate: ((totalPassed / totalTests) * 100).toFixed(1) + '%'
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 批量測試錯誤:', error);
    res.status(500).json({
      success: false,
      error: '批量測試失敗',
      message: error.message
    });
  }
});

// ==================== 測試健康檢查 ====================
app.get('/api/test/health', (req, res) => {
  const testStats = {
    totalLevels: Object.keys(TEST_STRATEGY).length,
    totalTestCases: Object.values(TEST_STRATEGY).reduce((sum, tests) => sum + tests.length, 0),
    levelBreakdown: Object.keys(TEST_STRATEGY).map(level => ({
      level,
      testCount: TEST_STRATEGY[level].length
    }))
  };
  
  res.json({
    success: true,
    service: 'AI Hotel Assistant - 分層測試框架',
    status: 'active',
    ...testStats,
    timestamp: new Date().toISOString()
  });
});

// ==================== 測試會話狀態檢查 ====================
app.get('/api/test/sessions', (req, res) => {
  const testSessions = Array.from(sessions.entries())
    .filter(([sessionId]) => sessionId.startsWith('test_'))
    .map(([sessionId, sessionData]) => ({
      sessionId,
      step: sessionData.step,
      createdAt: sessionData.createdAt,
      lastActive: sessionData.lastActive,
      data: sessionData.data
    }));
  
  res.json({
    success: true,
    testSessions,
    count: testSessions.length,
    timestamp: new Date().toISOString()
  });
});
// ==================== 分層測試框架 ====================
const TEST_STRATEGY = {
  // 第一層：基礎功能測試
  LEVEL1_BASIC: [
    { 
      name: "初始對話測試",
      input: "你好", 
      expectedKeywords: ["歡迎", "幫助", "您好"],
      sessionId: "test_basic_1"
    },
    { 
      name: "訂房意圖測試",
      input: "我想訂房", 
      expectedKeywords: ["房型", "房間", "標準", "豪華"],
      sessionId: "test_basic_2"
    },
    { 
      name: "一般詢問測試",
      input: "你們有什麼服務", 
      expectedKeywords: ["訂房", "幫助", "服務"],
      sessionId: "test_basic_3"
    }
  ],
  
  // 第二層：意圖識別測試
  LEVEL2_INTENT: [
    { 
      name: "選擇標準雙人房",
      input: "我要標準雙人房", 
      expectedKeywords: ["標準雙人房", "多少間", "入住多久"],
      expectedStep: "check_booking_details",
      sessionId: "test_intent_1"
    },
    { 
      name: "選擇豪華雙人房",
      input: "豪華雙人房", 
      expectedKeywords: ["豪華雙人房", "多少間", "入住多久"],
      expectedStep: "check_booking_details",
      sessionId: "test_intent_2"
    },
    { 
      name: "選擇套房",
      input: "我要訂套房", 
      expectedKeywords: ["套房", "多少間", "入住多久"],
      expectedStep: "check_booking_details",
      sessionId: "test_intent_3"
    },
    { 
      name: "優惠詢問意圖", 
      input: "有什麼優惠嗎",
      expectedKeywords: ["優惠", "折扣", "長者", "企業"],
      expectedStep: "handle_promotion_query",
      sessionId: "test_intent_4"
    },
    { 
      name: "取消訂房意圖",
      input: "我想取消訂房",
      expectedKeywords: ["取消", "訂單編號"],
      expectedStep: "cancel_init", 
      sessionId: "test_intent_5"
    }
  ],
  
  // 第三層：完整對話流程測試
  LEVEL3_FLOW: [
    {
      name: "完整訂房流程",
      sessionId: "test_flow_1",
      steps: [
        { input: "你好，我想預訂房間", expectedKeywords: ["歡迎", "幫助"] },
        { input: "標準雙人房", expectedKeywords: ["標準雙人房", "多少間", "入住多久"] },
        { input: "2間房間", expectedKeywords: ["2間", "確認", "詳細"] }
      ]
    },
    {
      name: "優惠詢問流程", 
      sessionId: "test_flow_2",
      steps: [
        { input: "有什麼促銷活動嗎", expectedKeywords: ["優惠", "折扣"] },
        { input: "長者優惠", expectedKeywords: ["長者", "資格", "條件"] }
      ]
    },
    {
      name: "取消訂房流程",
      sessionId: "test_flow_3", 
      steps: [
        { input: "我要取消訂房", expectedKeywords: ["取消", "訂單編號"] },
        { input: "ABC123", expectedKeywords: ["處理", "取消"] }
      ]
    }
  ]
};

// ==================== 測試輔助函數 ====================
async function testSingleMessage(input, sessionId, expectedKeywords, expectedStep) {
  return new Promise((resolve) => {
    // 模擬請求對象
    const req = {
      body: { 
        message: input, 
        sessionId: sessionId || `test_${Date.now()}`
      }
    };
    
    // 模擬響應對象
    const res = {
      json: (data) => {
        console.log(`💭 回覆: ${data.reply}`);
        console.log(`🔄 狀態: ${data.step}`);
        
        // 檢查關鍵字
        const keywordResults = expectedKeywords.map(keyword => ({
          keyword,
          found: data.reply.includes(keyword),
          position: data.reply.indexOf(keyword)
        }));
        
        const keywordPassed = keywordResults.every(result => result.found);
        const stepPassed = !expectedStep || data.step === expectedStep;
        const passed = keywordPassed && stepPassed;
        
        console.log(`🎯 關鍵字檢查: ${keywordPassed ? '✅' : '❌'}`);
        keywordResults.forEach(result => {
          console.log(`   ${result.found ? '✅' : '❌'} "${result.keyword}"`);
        });
        
        if (expectedStep) {
          console.log(`🔀 狀態檢查: ${stepPassed ? '✅' : '❌'} 期望: ${expectedStep}, 實際: ${data.step}`);
        }
        
        resolve({ 
          passed, 
          data,
          keywordResults,
          stepCheck: { expected: expectedStep, actual: data.step, passed: stepPassed }
        });
      },
      status: (code) => ({
        json: (data) => {
          console.log(`💥 錯誤 ${code}: ${data.error}`);
          resolve({ 
            passed: false, 
            data,
            error: { code, message: data.error }
          });
        }
      })
    };
    
    // 直接呼叫聊天處理邏輯
    try {
      // 創建會話
      const session = getOrCreateSession(req.body.sessionId);
      
      // 偵測意圖和實體
      const { intent, entities } = detectIntentAndEntities(req.body.message);
      console.log(`🎯 識別意圖: ${intent}, 實體:`, entities);
      
      // 決定狀態和回覆
      const { nextStep, reply } = decideStateAndReply(intent, entities, session);
      session.step = nextStep;
      
      // 保存會話
      sessions.set(req.body.sessionId, session);
      saveSessions().catch(console.error);
      
      // 模擬成功響應
      res.json({
        success: true,
        reply,
        sessionId: req.body.sessionId,
        step: session.step,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.log('💥 處理錯誤:', error.message);
      res.status(500).json({
        success: false,
        error: '處理失敗',
        message: error.message
      });
    }
  });
}

async function testFlow(steps, sessionId) {
  let allPassed = true;
  const results = [];
  const flowSessionId = sessionId || `flow_${Date.now()}`;
  
  console.log(`🔄 開始流程測試，會話ID: ${flowSessionId}`);
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n   📝 步驟 ${i + 1}/${steps.length}: "${step.input}"`);
    
    const result = await testSingleMessage(step.input, flowSessionId, step.expectedKeywords);
    results.push({
      step: i + 1,
      input: step.input,
      ...result
    });
    
    if (!result.passed) {
      allPassed = false;
    }
    
    // 步驟間稍微暫停，模擬真實對話
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`🔄 流程測試完成: ${allPassed ? '✅ 全部通過' : '❌ 有失敗步驟'}`);
  return { allPassed, results, sessionId: flowSessionId };
}

// ==================== 自動化測試執行器 ====================
async function runTests(testLevel = 'LEVEL1_BASIC') {
  console.log(`\n🧪 開始執行 ${testLevel} 測試...`);
  console.log(`📋 測試數量: ${TEST_STRATEGY[testLevel].length}`);
  
  const tests = TEST_STRATEGY[testLevel];
  let passed = 0;
  let failed = 0;
  const details = [];

  for (const test of tests) {
    console.log(`\n🔍 測試: ${test.name}`);
    console.log(`💬 輸入: "${test.input}"`);
    
    try {
      let testPassed = false;
      let testDetails = {};

      if (test.steps) {
        // 流程測試
        const flowResults = await testFlow(test.steps, test.sessionId);
        testPassed = flowResults.allPassed;
        testDetails = flowResults;
        console.log(testPassed ? '✅ 流程測試通過' : '❌ 流程測試失敗');
      } else {
        // 單一訊息測試
        const result = await testSingleMessage(
          test.input, 
          test.sessionId, 
          test.expectedKeywords, 
          test.expectedStep
        );
        
        testPassed = result.passed;
        testDetails = result;
        console.log(testPassed ? '✅ 測試通過' : '❌ 測試失敗');
      }

      if (testPassed) {
        passed++;
      } else {
        failed++;
      }

      details.push({
        name: test.name,
        passed: testPassed,
        details: testDetails
      });

    } catch (error) {
      failed++;
      console.log('💥 測試執行錯誤:', error.message);
      details.push({
        name: test.name,
        passed: false,
        error: error.message
      });
    }
  }
  
  console.log(`\n📊 ${testLevel} 測試結果: ${passed} 通過, ${failed} 失敗`);
  return { passed, failed, total: tests.length, details };
}

// ==================== 測試API接口 ====================
app.get('/api/test/run', async (req, res) => {
  try {
    const { level = 'LEVEL1_BASIC' } = req.query;
    
    if (!TEST_STRATEGY[level]) {
      return res.status(400).json({
        success: false,
        error: '不支援的測試等級',
        supportedLevels: Object.keys(TEST_STRATEGY),
        description: '可用等級: LEVEL1_BASIC, LEVEL2_INTENT, LEVEL3_FLOW'
      });
    }
    
    console.log(`\n🚀 收到測試請求: ${level}`);
    const results = await runTests(level);
    
    res.json({
      success: true,
      level,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 測試執行錯誤:', error);
    res.status(500).json({
      success: false,
      error: '測試執行失敗',
      message: error.message
    });
  }
});

app.get('/api/test/levels', (req, res) => {
  const levels = Object.keys(TEST_STRATEGY).map(level => ({
    name: level,
    description: getLevelDescription(level),
    testCount: TEST_STRATEGY[level].length,
    exampleTests: TEST_STRATEGY[level].slice(0, 2).map(test => ({
      name: test.name,
      input: test.input
    }))
  }));
  
  res.json({
    success: true,
    levels,
    totalTestCases: Object.values(TEST_STRATEGY).reduce((sum, tests) => sum + tests.length, 0)
  });
});

function getLevelDescription(level) {
  const descriptions = {
    'LEVEL1_BASIC': '基礎功能測試 - 驗證基本對話能力和服務響應',
    'LEVEL2_INTENT': '意圖識別測試 - 驗證意圖偵測和狀態轉換正確性', 
    'LEVEL3_FLOW': '完整流程測試 - 驗證多輪對話流程和會話狀態保持'
  };
  return descriptions[level] || '未知測試等級';
}

// ==================== 批量測試接口 ====================
app.get('/api/test/run-all', async (req, res) => {
  try {
    console.log('\n🎯 開始執行所有測試等級...');
    
    const results = {};
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;
    
    // 按順序執行所有測試等級
    for (const level of ['LEVEL1_BASIC', 'LEVEL2_INTENT', 'LEVEL3_FLOW']) {
      console.log(`\n📁 執行等級: ${level}`);
      const levelResults = await runTests(level);
      results[level] = levelResults;
      
      totalPassed += levelResults.passed;
      totalFailed += levelResults.failed;
      totalTests += levelResults.total;
      
      // 如果基礎測試失敗，停止後續測試
      if (level === 'LEVEL1_BASIC' && levelResults.failed > 0) {
        console.log('⚠️  基礎測試失敗，停止執行後續測試');
        break;
      }
    }
    
    const overallPassed = totalFailed === 0;
    
    res.json({
      success: true,
      overall: {
        passed: overallPassed,
        totalPassed,
        totalFailed, 
        totalTests,
        passRate: ((totalPassed / totalTests) * 100).toFixed(1) + '%'
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 批量測試錯誤:', error);
    res.status(500).json({
      success: false,
      error: '批量測試失敗',
      message: error.message
    });
  }
});

// ==================== 測試健康檢查 ====================
app.get('/api/test/health', (req, res) => {
  const testStats = {
    totalLevels: Object.keys(TEST_STRATEGY).length,
    totalTestCases: Object.values(TEST_STRATEGY).reduce((sum, tests) => sum + tests.length, 0),
    levelBreakdown: Object.keys(TEST_STRATEGY).map(level => ({
      level,
      testCount: TEST_STRATEGY[level].length
    }))
  };
  
  res.json({
    success: true,
    service: 'AI Hotel Assistant - 分層測試框架',
    status: 'active',
    ...testStats,
    timestamp: new Date().toISOString()
  });
});

// ==================== 測試會話狀態檢查 ====================
app.get('/api/test/sessions', (req, res) => {
  const testSessions = Array.from(sessions.entries())
    .filter(([sessionId]) => sessionId.startsWith('test_'))
    .map(([sessionId, sessionData]) => ({
      sessionId,
      step: sessionData.step,
      createdAt: sessionData.createdAt,
      lastActive: sessionData.lastActive,
      data: sessionData.data
    }));
  
  res.json({
    success: true,
    testSessions,
    count: testSessions.length,
    timestamp: new Date().toISOString()
  });
});

console.log('✅ 分層測試框架已載入');
console.log('📋 測試等級:', Object.keys(TEST_STRATEGY));
console.log('🧪 總測試案例:', Object.values(TEST_STRATEGY).reduce((sum, tests) => sum + tests.length, 0));
console.log('🌐 測試接口:');
console.log('   GET /api/test/health          - 測試框架健康檢查');
console.log('   GET /api/test/levels          - 獲取測試等級資訊');
console.log('   GET /api/test/run?level=XXX   - 執行特定等級測試');
console.log('   GET /api/test/run-all         - 執行所有測試');
console.log('   GET /api/test/sessions        - 查看測試會話狀態');

module.exports = app;

