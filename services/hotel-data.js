const hotelData = {
  hotelInfo: {
    name: "台北晶華酒店",
    stars: 5,
    phone: "+886-2-2523-8000"
  },

  roomTypes: [
    {
      id: "deluxe",
      name: "豪華客房",
      size: "35平方公尺",
      capacity: { adults: 2, children: 1 },
      basePrice: 8800,
      breakfastIncluded: false,
      breakfastPrice: 650
    },
    {
      id: "executive",
      name: "行政客房",
      size: "42平方公尺",
      capacity: { adults: 2, children: 1 },
      basePrice: 12800,
      breakfastIncluded: true,
      breakfastPrice: 0
    },
    {
      id: "suite",
      name: "套房",
      size: "68平方公尺",
      capacity: { adults: 3, children: 2 },
      basePrice: 18800,
      breakfastIncluded: true,
      breakfastPrice: 0
    },
    {
      id: "presidential",
      name: "總統套房",
      size: "120平方公尺",
      capacity: { adults: 4, children: 2 },
      basePrice: 38800,
      breakfastIncluded: true,
      breakfastPrice: 0
    }
  ],

  pricingRules: {
    extraBed: {
      price: 1200
    },
    childPolicy: {
      freeAge: 6,
      childBedPrice: 800,
      adultBedPrice: 1200
    },
    longStayDiscount: [
      { nights: 3, discount: 5, description: "住3晚享95折" },
      { nights: 5, discount: 10, description: "住5晚享9折" },
      { nights: 7, discount: 15, description: "住7晚享85折" }
    ]
  },

  promotions: [
    {
      id: "earlybird",
      name: "早鳥優惠",
      description: "提前30天預訂享85折",
      discount: 15
    }
  ],

  addons: [
    {
      id: "breakfast",
      name: "早餐券",
      price: 650
    },
    {
      id: "airport",
      name: "機場接送",
      price: 1500
    },
    {
      id: "parking",
      name: "停車位",
      price: 500
    }
  ]
};

module.exports = hotelData;
