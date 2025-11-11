const hotelData = {
  roomTypes: [
    {
      id: 'standard',
      name: '標準房',
      basePrice: 2200,
      maxGuests: 2,
      minNights: 1,
      maxNights: 30,
      minRooms: 1,
      maxRooms: 5,
      available: true
    },
    {
      id: 'deluxe',
      name: '豪華房', 
      basePrice: 2800,
      maxGuests: 3,
      minNights: 1,
      maxNights: 30,
      minRooms: 1,
      maxRooms: 4,
      available: true
    },
    {
      id: 'suite',
      name: '套房',
      basePrice: 4500,
      maxGuests: 4,
      minNights: 2,
      maxNights: 14,
      minRooms: 1,
      maxRooms: 3,
      available: true
    },
    {
      id: 'family',
      name: '家庭房',
      basePrice: 3800,
      maxGuests: 5,
      minNights: 1,
      maxNights: 30,
      minRooms: 1,
      maxRooms: 2,
      available: true
    }
  ],
  
  globalRestrictions: {
    maxTotalRooms: 10,
    advanceBookingDays: 180,
    minCheckInHours: 24
  },
  
  blackoutDates: [
    '2024-02-09', '2024-02-10', '2024-02-11', // 春節
    '2024-04-04', '2024-04-05', '2024-04-06', // 清明節
    '2024-06-08', '2024-06-09', '2024-06-10'  // 端午節
  ],
  
  noCheckoutDates: [
    '2024-02-08', // 除夕前一天
    '2024-12-31'  // 跨年夜
  ]
};

module.exports = hotelData;
