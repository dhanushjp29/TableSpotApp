import Food from "../../../src/models/food.js";
import { CODE_PREFIX, getGstRateForCategory } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne } from "../lib/helpers.mjs";
import { foodImages } from "../lib/images.mjs";

const F = (name, category, foodType, price, description, opts = {}) => ({
  name,
  category,
  foodType,
  price,
  description,
  spice: opts.spice || "Medium",
  prep: opts.prep || 15,
  rec: Boolean(opts.rec),
  pop: Boolean(opts.pop),
  variants: opts.variants || null,
});

export const FOODS_SPEC = {
  flagship: [
    F("Hyderabadi Chicken Dum Biryani", "Biryani", "Non-Veg", 320, "Slow-cooked on dum with saffron, mint and roasted chicken.", { rec: true, pop: true, prep: 30, variants: [["Half", 190], ["Full", 320]] }),
    F("Mutton Dum Biryani", "Biryani", "Non-Veg", 420, "Tender mutton layered with fragrant basmati and biryani masala.", { pop: true, prep: 35, variants: [["Half", 250], ["Full", 420]] }),
    F("Veg Biryani", "Biryani", "Veg", 220, "Garden vegetables and paneer in aromatic dum biryani.", { prep: 25 }),
    F("Chicken 65", "Starters", "Non-Veg", 280, "Fiery deep-fried chicken tossed with curry leaves and chilli.", { pop: true, spice: "Hot", prep: 20 }),
    F("Paneer Tikka", "Starters", "Veg", 260, "Char-grilled paneer cubes marinated in yogurt and spices.", { rec: true, prep: 20 }),
    F("Chicken Kebab Platter", "Starters", "Non-Veg", 340, "Assorted seekh, tikka and malai kebabs with mint chutney.", { pop: true, prep: 25 }),
    F("Butter Chicken", "Main Course", "Non-Veg", 380, "Creamy tomato gravy with tandoor-roasted chicken.", { rec: true, pop: true, prep: 25 }),
    F("Dal Makhani", "Main Course", "Veg", 240, "Black lentils slow-cooked overnight with butter and cream.", { pop: true, prep: 20 }),
    F("Garlic Naan", "Main Course", "Veg", 60, "Tandoor-baked naan brushed with garlic butter.", { prep: 10 }),
    F("Gulab Jamun", "Desserts", "Veg", 120, "Soft khoya dumplings in rose-cardamom syrup.", { prep: 10 }),
    F("Double Ka Meetha", "Desserts", "Veg", 150, "Hyderabadi bread pudding with saffron and dry fruits.", { rec: true, prep: 10 }),
    F("Sweet Lassi", "Beverages", "Veg", 90, "Thick churned yogurt drink topped with malai.", { prep: 5 }),
  ],
  chettinad: [
    F("Karaikudi Chicken Curry", "Main Course", "Non-Veg", 340, "Fiery Chettinad curry with roasted spices and coconut.", { pop: true, spice: "Hot", prep: 30 }),
    F("Appam", "Main Course", "Veg", 50, "Lacy fermented rice pancakes with crisp edges.", { prep: 10 }),
    F("Vegetable Chettinad Kuzhambu", "Main Course", "Veg", 240, "Tangy village-style gravy with mixed vegetables.", { spice: "Hot", prep: 25 }),
    F("Prawn Puttu", "Starters", "Non-Veg", 380, "Karaikudi-spiced prawns tossed with grated coconut.", { pop: true, spice: "Hot", prep: 25 }),
    F("Pepper Chicken Fry", "Starters", "Non-Veg", 320, "Crunchy chicken fry coated in crushed black pepper.", { spice: "Hot", prep: 25 }),
    F("Parotta", "Main Course", "Veg", 40, "Flaky layered Malabar parotta.", { prep: 10 }),
    F("Chettinad Fish Fry", "Starters", "Non-Veg", 360, "Seer fish marinated in Chettinad masala and pan-fried.", { rec: true, spice: "Hot", prep: 20 }),
    F("Mutton Chukka", "Main Course", "Non-Veg", 400, "Dry mutton roast with curry leaves and Chettinad spices.", { rec: true, spice: "Hot", prep: 35 }),
    F("Payasam", "Desserts", "Veg", 110, "Creamy rice vermicelli payasam with cashews.", { prep: 10 }),
    F("Filter Coffee", "Beverages", "Veg", 60, "Frothy South Indian filter coffee in a steel tumbler.", { pop: true, prep: 5 }),
    F("Curd Rice", "Main Course", "Veg", 160, "Comforting tempered yogurt rice.", { prep: 5 }),
  ],
  coastal: [
    F("Fish Curry with Rice", "Main Course", "Non-Veg", 320, "Kerala-style fish curry in tangy coconut tamarind gravy.", { pop: true, spice: "Hot", prep: 30 }),
    F("Prawn Fry", "Starters", "Non-Veg", 420, "Juicy prawns tossed in coastal masala with curry leaves.", { rec: true, pop: true, spice: "Hot", prep: 20 }),
    F("Squid Pepper Fry", "Starters", "Non-Veg", 380, "Tender squid stir-fried with crushed pepper and onions.", { spice: "Hot", prep: 20 }),
    F("Kerala Fish Molee", "Main Course", "Non-Veg", 360, "Fish simmered in mild coconut milk with green chillies.", { prep: 30 }),
    F("Appam with Stew", "Main Course", "Veg", 220, "Appam served with creamy vegetable stew.", { rec: true, prep: 15 }),
    F("Crab Masala", "Main Course", "Non-Veg", 480, "Whole crab cooked in rich coconut masala.", { pop: true, spice: "Hot", prep: 40 }),
    F("Neer Dosa", "Main Course", "Veg", 90, "Soft paper-thin coastal rice dosa.", { prep: 10 }),
    F("Tandoori Pomfret", "Starters", "Non-Veg", 520, "Pomfret marinated in spices and tandoor-roasted.", { rec: true, prep: 30 }),
    F("Coconut Payasam", "Desserts", "Veg", 130, "Semolina payasam simmered in thick coconut milk.", { prep: 10 }),
    F("Tender Coconut Water", "Juices", "Veg", 80, "Chilled natural tender coconut water.", { prep: 5 }),
  ],
  "madras-cafe": [
    F("Ghee Podi Dosa", "South Indian", "Veg", 140, "Crispy dosa smeared with ghee and gunpowder podi.", { pop: true, prep: 15 }),
    F("Masala Dosa", "South Indian", "Veg", 120, "Golden crispy dosa with potato masala and chutneys.", { pop: true, prep: 15 }),
    F("Idli", "South Indian", "Veg", 60, "Steamed rice cakes served with sambar and chutney.", { prep: 10 }),
    F("Medu Vada", "South Indian", "Veg", 50, "Crisp urad dal vada with coconut chutney.", { prep: 10 }),
    F("Rava Upma", "South Indian", "Veg", 90, "Tempered semolina upma with curry leaves and cashews.", { prep: 10 }),
    F("Ven Pongal", "South Indian", "Veg", 110, "Comforting rice-lentil pongal with ghee and pepper.", { rec: true, prep: 15 }),
    F("Kesari", "Desserts", "Veg", 100, "Saffron semolina pudding with ghee and raisins.", { prep: 10 }),
    F("Filter Coffee", "Beverages", "Veg", 50, "Signature frothy South Indian filter coffee.", { pop: true, prep: 5 }),
    F("Masala Chai", "Beverages", "Veg", 40, "Ginger-spiced Indian milk tea.", { prep: 5 }),
    F("Curd Rice", "South Indian", "Veg", 130, "Tempered yogurt rice with ginger and pomegranate.", { prep: 5 }),
  ],
  "biryani-house": [
    F("Chicken Dum Biryani", "Biryani", "Non-Veg", 280, "Aromatic chicken dum biryani with raita.", { pop: true, prep: 30, variants: [["Half", 170], ["Full", 280]] }),
    F("Mutton Biryani", "Biryani", "Non-Veg", 380, "Slow-cooked mutton biryani layered with fried onions.", { rec: true, prep: 35, variants: [["Half", 220], ["Full", 380]] }),
    F("Egg Biryani", "Biryani", "Egg", 200, "Spiced egg biryani with boondi raita.", { prep: 25 }),
    F("Veg Biryani", "Biryani", "Veg", 190, "Vegetable biryani with mint raita.", { prep: 25 }),
    F("Chicken Kebab", "Starters", "Non-Veg", 300, "Charcoal-grilled chicken tikka kebabs.", { pop: true, prep: 20 }),
    F("Seekh Kebab", "Starters", "Non-Veg", 280, "Mince kebab rolls with coriander and spices.", { prep: 20 }),
    F("Chicken 65", "Starters", "Non-Veg", 240, "Crispy chilli-tossed chicken 65.", { pop: true, spice: "Hot", prep: 20 }),
    F("Veg Raita", "Main Course", "Veg", 50, "Cooling cucumber and onion raita.", { prep: 5 }),
    F("Mirchi Ka Salan", "Main Course", "Veg", 90, "Tangy peanut and chilli gravy served with biryani.", { prep: 10 }),
    F("Double Ka Meetha", "Desserts", "Veg", 100, "Bread pudding with saffron and nuts.", { prep: 10 }),
    F("Sweet Lassi", "Beverages", "Veg", 110, "Creamy sweet lassi with malai topping.", { pop: true, prep: 5 }),
  ],
  "dosa-junction": [
    F("Mysore Masala Dosa", "South Indian", "Veg", 160, "Dosa layered with fiery red chutney and potato masala.", { pop: true, spice: "Hot", prep: 15 }),
    F("Cheese Burst Dosa", "South Indian", "Veg", 200, "Dosa stuffed with molten cheese and masala.", { rec: true, pop: true, prep: 15 }),
    F("Onion Uttapam", "South Indian", "Veg", 130, "Thick dosa topped with onions, tomato and coriander.", { prep: 15 }),
    F("Rava Dosa", "South Indian", "Veg", 150, "Lacy semolina dosa, crisp and golden.", { prep: 15 }),
    F("Idli Sambar", "South Indian", "Veg", 70, "Steamed idlis with piping hot sambar.", { prep: 10 }),
    F("Medu Vada", "South Indian", "Veg", 60, "Crunchy vada with chutney and sambar.", { prep: 10 }),
    F("Paneer Dosa", "South Indian", "Veg", 180, "Crispy dosa with spiced paneer filling.", { prep: 15 }),
    F("Filter Coffee", "Beverages", "Veg", 50, "Traditional filter coffee decoction.", { prep: 5 }),
    F("Kesari Bath", "Desserts", "Veg", 90, "Saffron semolina sweet with ghee.", { prep: 10 }),
    F("Curd Vada", "South Indian", "Veg", 110, "Vada soaked in spiced curd with tadka.", { prep: 10 }),
  ],
  "rooftop-pizzeria": [
    F("Margherita Pizza", "Pizza", "Veg", 299, "Classic wood-fired pizza with San Marzano tomato, mozzarella and basil.", { pop: true, prep: 20, variants: [["Regular", 299], ["Large", 449]] }),
    F("Farmhouse Pizza", "Pizza", "Veg", 399, "Loaded with onion, capsicum, corn, mushroom and olives.", { prep: 20, variants: [["Regular", 399], ["Large", 549]] }),
    F("Chicken BBQ Pizza", "Pizza", "Non-Veg", 449, "Smoky BBQ chicken with red onion and mozzarella.", { rec: true, pop: true, prep: 20, variants: [["Regular", 449], ["Large", 599]] }),
    F("Paneer Tikka Pizza", "Pizza", "Veg", 399, "Tandoori paneer tikka with spiced tomato base.", { prep: 20 }),
    F("Penne Arrabbiata", "Pasta", "Veg", 349, "Penne in fiery garlic-tomato sauce with chilli flakes.", { spice: "Hot", prep: 15 }),
    F("Alfredo Pasta", "Pasta", "Veg", 389, "Creamy parmesan Alfredo with mushroom.", { rec: true, prep: 15 }),
    F("Peri Peri Fries", "Starters", "Veg", 199, "Crispy fries tossed in peri peri seasoning.", { pop: true, prep: 10 }),
    F("Chicken Wings", "Starters", "Non-Veg", 329, "Sticky BBQ buffalo wings with ranch dip.", { pop: true, prep: 20 }),
    F("Garlic Bread", "Starters", "Veg", 179, "Toasted ciabatta with garlic butter and herbs.", { prep: 10 }),
    F("Tiramisu", "Desserts", "Veg", 249, "Coffee-soaked layers with mascarpone cream.", { rec: true, prep: 5 }),
    F("Fresh Lime Soda", "Beverages", "Veg", 99, "Sparkling lime soda, sweet or salted.", { prep: 5 }),
  ],
  "mumbai-tiffin": [
    F("Unlimited Veg Thali", "Combo", "Veg", 249, "All-you-can-eat veg thali with 2 sabzis, dal, rice, roti and sweet.", { pop: true, prep: 20 }),
    F("Unlimited Non-Veg Thali", "Combo", "Non-Veg", 349, "Unlimited thali with chicken curry, egg and fish fry.", { rec: true, pop: true, prep: 25 }),
    F("Vada Pav", "Starters", "Veg", 30, "Mumbai's beloved batata vada in a soft pav with chutneys.", { pop: true, prep: 10 }),
    F("Pav Bhaji", "Main Course", "Veg", 160, "Buttery mashed vegetable bhaji with toasted pav.", { pop: true, prep: 20 }),
    F("Misal Pav", "Main Course", "Veg", 140, "Spicy sprouted moth bean curry topped with farsan.", { spice: "Hot", prep: 20 }),
    F("Sabudana Khichdi", "Main Course", "Veg", 120, "Tapioca pearls tempered with peanuts and lemon.", { prep: 15 }),
    F("Paneer Bhurji", "Main Course", "Veg", 220, "Scrambled paneer with onions, tomato and spices.", { prep: 15 }),
    F("Chicken Thali", "Combo", "Non-Veg", 320, "Chicken curry, rice, roti and dessert in one platter.", { prep: 25 }),
    F("Shrikhand", "Desserts", "Veg", 110, "Silky strained yogurt sweet with saffron.", { rec: true, prep: 5 }),
    F("Kokum Sherbet", "Beverages", "Veg", 70, "Refreshing Maharashtrian kokum cooler.", { prep: 5 }),
    F("Masala Chai", "Beverages", "Veg", 40, "Kadak chai with ginger and cardamom.", { prep: 5 }),
  ],
  "street-wok": [
    F("Veg Hakka Noodles", "Chinese", "Veg", 180, "Wok-tossed noodles with crunchy vegetables.", { pop: true, prep: 12 }),
    F("Chicken Hakka Noodles", "Chinese", "Non-Veg", 240, "Noodles tossed with shredded chicken and spring onion.", { prep: 12 }),
    F("Veg Fried Rice", "Chinese", "Veg", 190, "Classic Chinese fried rice with veggies.", { prep: 12 }),
    F("Chilli Paneer", "Chinese", "Veg", 260, "Crispy paneer in spicy soy-chilli sauce.", { pop: true, spice: "Hot", prep: 15 }),
    F("Chilli Chicken", "Chinese", "Non-Veg", 280, "Fried chicken tossed in fiery Indo-Chinese sauce.", { rec: true, spice: "Hot", prep: 15 }),
    F("Veg Spring Rolls", "Chinese", "Veg", 150, "Crispy rolls with shredded veg filling.", { prep: 12 }),
    F("Veg Momos", "Chinese", "Veg", 120, "Steamed dumplings with spicy momo chutney.", { pop: true, prep: 15 }),
    F("Chicken Momos", "Chinese", "Non-Veg", 160, "Juicy chicken dumplings steamed to perfection.", { prep: 15 }),
    F("Schezwan Fried Rice", "Chinese", "Veg", 210, "Spicy schezwan fried rice with burnt garlic.", { spice: "Hot", prep: 12 }),
    F("Honey Chilli Potato", "Chinese", "Veg", 170, "Crispy potato fingers glazed in honey-chilli.", { prep: 12 }),
  ],
  "chai-co": [
    F("Masala Chai", "Beverages", "Veg", 50, "Slow-brewed masala chai with fresh ginger.", { pop: true, prep: 8 }),
    F("Cut Chai", "Beverages", "Veg", 30, "Bombay-style half glass, double shot chai.", { prep: 8 }),
    F("Cold Coffee", "Beverages", "Veg", 140, "Frothy blended cold coffee with ice cream.", { pop: true, prep: 8 }),
    F("Iced Americano", "Beverages", "Veg", 160, "Double espresso over ice.", { prep: 5 }),
    F("Chicken Tikka Sandwich", "Sandwich", "Non-Veg", 180, "Grilled sandwich with tikka chicken and mint mayo.", { rec: true, prep: 10 }),
    F("Grilled Veg Sandwich", "Sandwich", "Veg", 120, "Cheesy grilled sandwich with fresh veggies.", { prep: 10 }),
    F("Samosa", "Starters", "Veg", 30, "Crisp samosa with tangy chutney.", { pop: true, prep: 8 }),
    F("Bread Pakora", "Starters", "Veg", 60, "Stuffed bread slices fried in gram flour batter.", { prep: 10 }),
    F("Gulab Jamun Cheesecake", "Desserts", "Veg", 220, "Cheesecake fused with gulab jamun and rose.", { rec: true, prep: 5 }),
    F("Brownie with Ice Cream", "Desserts", "Veg", 199, "Warm chocolate brownie with vanilla scoop.", { prep: 8 }),
    F("Cheese Garlic Fries", "Starters", "Veg", 150, "Fries tossed with garlic butter and parmesan.", { prep: 8 }),
  ],
  "hyderabad-dum": [
    F("Hyderabadi Chicken Dum Biryani", "Biryani", "Non-Veg", 350, "Kacchi-style chicken dum biryani with mirchi ka salan.", { pop: true, prep: 30, variants: [["Half", 210], ["Full", 350]] }),
    F("Mutton Dum Biryani", "Biryani", "Non-Veg", 450, "Rich mutton dum biryani with saffron rice.", { rec: true, prep: 35, variants: [["Half", 270], ["Full", 450]] }),
    F("Chicken 65", "Starters", "Non-Veg", 280, "Fiery fried chicken with curry leaves.", { pop: true, spice: "Hot", prep: 20 }),
    F("Chicken Kebab Platter", "Starters", "Non-Veg", 380, "Mixed kebab platter with mint chutney.", { prep: 25 }),
    F("Paneer Tikka", "Starters", "Veg", 270, "Smoky grilled paneer tikka.", { prep: 20 }),
    F("Dal Tadka", "Main Course", "Veg", 210, "Yellow dal tempered with ghee and garlic.", { prep: 15 }),
    F("Shahi Paneer", "Main Course", "Veg", 280, "Paneer in rich creamy tomato-cashew gravy.", { prep: 20 }),
    F("Chicken Curry", "Main Course", "Non-Veg", 320, "Home-style chicken curry with masala gravy.", { prep: 25 }),
    F("Mirchi Ka Salan", "Main Course", "Veg", 90, "Peanut-based chilli gravy classic.", { prep: 10 }),
    F("Veg Raita", "Main Course", "Veg", 60, "Cooling raita with boondi.", { prep: 5 }),
    F("Khubani Ka Meetha", "Desserts", "Veg", 120, "Hyderabadi apricot dessert with cream.", { rec: true, prep: 10 }),
  ],
  "paradise-corner": [
    F("Ghee Roast Dosa", "South Indian", "Veg", 170, "Crisp dosa roasted in ghee with podi.", { pop: true, prep: 15 }),
    F("Plain Dosa", "South Indian", "Veg", 100, "Golden plain dosa with chutneys and sambar.", { prep: 12 }),
    F("Idli Sambar", "South Indian", "Veg", 70, "Soft idlis dunked in hot sambar.", { prep: 10 }),
    F("Upma", "South Indian", "Veg", 90, "Sooji upma with mustard and curry leaves.", { prep: 10 }),
    F("Ven Pongal", "South Indian", "Veg", 120, "Ghee-rich pongal with pepper and jeera.", { rec: true, prep: 15 }),
    F("Onion Rava Dosa", "South Indian", "Veg", 150, "Lacy rava dosa with caramelised onion.", { prep: 12 }),
    F("Curd Rice", "South Indian", "Veg", 140, "Tempered yogurt rice, mild and soothing.", { prep: 5 }),
    F("Filter Coffee", "Beverages", "Veg", 50, "Strong decoction filter coffee.", { prep: 5 }),
    F("Kesari", "Desserts", "Veg", 90, "Saffron semolina halwa.", { prep: 10 }),
    F("Badam Milk", "Beverages", "Veg", 80, "Warm almond milk with saffron.", { prep: 8 }),
  ],
  "pune-thali": [
    F("Special Veg Thali", "Combo", "Veg", 229, "Unlimited special thali with bhaji, dal, bhakri, rice and puran poli.", { pop: true, prep: 20 }),
    F("Maharashtrian Thali", "Combo", "Veg", 199, "Traditional thali with varan, bhaat, koshimbir and thecha.", { prep: 20 }),
    F("Paneer Thali", "Combo", "Veg", 249, "Thali featuring paneer sabzi, dal and phulka.", { prep: 20 }),
    F("Puran Poli", "Desserts", "Veg", 90, "Sweet chana dal stuffed flatbread with ghee.", { rec: true, prep: 10 }),
    F("Varan Bhaat", "Main Course", "Veg", 140, "Comforting dal-rice with ghee and lemon.", { prep: 15 }),
    F("Bhakri", "Main Course", "Veg", 40, "Ragi or jowar flatbread from the tawa.", { prep: 10 }),
    F("Aamras", "Desserts", "Veg", 110, "Seasonal fresh mango pulp.", { prep: 5 }),
    F("Kothimbir Vadi", "Starters", "Veg", 130, "Steamed, then fried coriander bites.", { pop: true, prep: 15 }),
    F("Batata Vada", "Starters", "Veg", 40, "Spicy potato vada, Pune style.", { prep: 10 }),
    F("Sol Kadhi", "Beverages", "Veg", 70, "Chilled kokum-coconut milk cooler.", { prep: 5 }),
  ],
  "bake-brew": [
    F("Butter Croissant", "Desserts", "Veg", 120, "Flaky all-butter croissant, baked every morning.", { pop: true, prep: 5 }),
    F("Chocolate Croissant", "Desserts", "Veg", 140, "Croissant with dark chocolate filling.", { prep: 5 }),
    F("Margherita Pizza", "Pizza", "Veg", 329, "Neapolitan-style margherita with buffalo mozzarella.", { prep: 18 }),
    F("Chicken Pesto Sandwich", "Sandwich", "Non-Veg", 260, "Grilled chicken with basil pesto and rocket.", { rec: true, prep: 10 }),
    F("Cappuccino", "Beverages", "Veg", 150, "Espresso with silky steamed milk.", { pop: true, prep: 5 }),
    F("Flat White", "Beverages", "Veg", 160, "Double shot espresso with micro-foam.", { prep: 5 }),
    F("Blueberry Cheesecake", "Desserts", "Veg", 220, "Baked cheesecake with blueberry compote.", { rec: true, prep: 5 }),
    F("Tiramisu Cup", "Desserts", "Veg", 180, "Single-serve tiramisu with cocoa dust.", { prep: 5 }),
    F("Peri Peri Chicken Wrap", "Sandwich", "Non-Veg", 240, "Spicy peri peri chicken in a soft tortilla.", { prep: 10 }),
    F("Fresh Orange Juice", "Juices", "Veg", 130, "Cold-pressed seasonal oranges.", { prep: 5 }),
    F("Chocolate Mousse", "Desserts", "Veg", 160, "Airy dark chocolate mousse.", { prep: 5 }),
  ],
  "green-leaf": [
    F("Paneer Butter Masala", "North Indian", "Veg", 280, "Rich paneer in makhani tomato gravy.", { pop: true, prep: 20 }),
    F("Dal Makhani", "North Indian", "Veg", 230, "Slow-cooked black dal with cream.", { pop: true, prep: 20 }),
    F("Veg Kofta Curry", "North Indian", "Veg", 260, "Vegetable koftas in creamy curry.", { prep: 25 }),
    F("Palak Paneer", "North Indian", "Veg", 240, "Paneer cubes in silky spinach gravy.", { prep: 20 }),
    F("Butter Naan", "North Indian", "Veg", 60, "Tandoor naan brushed with butter.", { prep: 10 }),
    F("Tandoori Roti", "North Indian", "Veg", 40, "Whole-wheat tandoor roti.", { prep: 10 }),
    F("Jeera Rice", "North Indian", "Veg", 160, "Fragrant cumin tempered basmati rice.", { prep: 15 }),
    F("Veg Biryani", "Biryani", "Veg", 210, "Aromatic vegetable dum biryani.", { prep: 25 }),
    F("Gulab Jamun", "Desserts", "Veg", 100, "Warm khoya gulab jamun.", { prep: 5 }),
    F("Rose Lassi", "Beverages", "Veg", 90, "Chilled rose-flavoured lassi.", { prep: 5 }),
  ],
  "kochi-spice": [
    F("Kerala Fish Curry", "Main Course", "Non-Veg", 300, "Fish in fiery coconut-tamarind gravy.", { pop: true, spice: "Hot", prep: 25 }),
    F("Appam", "Main Course", "Veg", 45, "Soft lacy rice appam.", { prep: 8 }),
    F("Chicken Stew", "Main Course", "Non-Veg", 280, "Mild coconut milk chicken stew with appam.", { rec: true, prep: 25 }),
    F("Malabar Parotta", "Main Course", "Veg", 50, "Flaky layered parotta.", { prep: 8 }),
    F("Beef Ularthiyathu", "Main Course", "Non-Veg", 340, "Dry-fried beef with roasted coconut and spices.", { spice: "Hot", prep: 30 }),
    F("Prawn Roast", "Starters", "Non-Veg", 420, "Coastal prawn roast with shallots and curry leaves.", { pop: true, spice: "Hot", prep: 20 }),
    F("Kerala Veg Stew", "Main Course", "Veg", 220, "Vegetables simmered in coconut milk.", { prep: 20 }),
    F("Puttu & Kadala Curry", "Main Course", "Veg", 140, "Steamed rice cake with black chickpea curry.", { prep: 15 }),
    F("Palada Payasam", "Desserts", "Veg", 120, "Rice ada payasam with milk and ghee.", { prep: 10 }),
    F("Karikku", "Juices", "Veg", 70, "Chilled tender coconut.", { prep: 5 }),
  ],
  "sunset-grill": [
    F("Grilled Chicken Steak", "Main Course", "Non-Veg", 499, "Char-grilled chicken steak with pepper jus.", { pop: true, prep: 25 }),
    F("BBQ Pork Ribs", "Main Course", "Non-Veg", 599, "Slow-cooked ribs glazed in smoky BBQ sauce.", { rec: true, prep: 30 }),
    F("Grilled Fish Platter", "Main Course", "Non-Veg", 549, "Fresh catch grilled with lemon butter.", { prep: 25 }),
    F("Paneer Tikka Wrap", "Sandwich", "Veg", 279, "Tandoori paneer tikka in a grilled wrap.", { prep: 12 }),
    F("Peri Peri Fries", "Starters", "Veg", 199, "Crispy fries dusted with peri peri.", { pop: true, prep: 8 }),
    F("Chicken Wings", "Starters", "Non-Veg", 329, "Fiery buffalo wings with blue cheese dip.", { pop: true, spice: "Hot", prep: 20 }),
    F("Garlic Prawns", "Starters", "Non-Veg", 449, "Butter-garlic prawns with herbs.", { prep: 15 }),
    F("Prawn Biryani", "Biryani", "Non-Veg", 399, "Coastal prawn biryani with saffron.", { prep: 30 }),
    F("Tropical Mocktail", "Beverages", "Veg", 179, "Pineapple-mint cooler with passion fruit.", { prep: 8 }),
    F("Choco Lava Cake", "Desserts", "Veg", 149, "Molten chocolate cake with vanilla scoop.", { prep: 12 }),
  ],
};

export const seedFoods = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;

  for (const restaurantKey of Object.keys(FOODS_SPEC)) {
    const restaurant = ctx.restaurants.get(restaurantKey).doc;
    const foodSpecs = FOODS_SPEC[restaurantKey];

    for (let i = 0; i < foodSpecs.length; i += 1) {
      const spec = foodSpecs[i];
      codeIndex += 1;
      const foodCode = codeFor(CODE_PREFIX.FOOD, codeIndex);

      const variants = spec.variants
        ? spec.variants.map(([variantName, price]) => ({
            variantName,
            price,
            offerPrice: 0,
          }))
        : [{ variantName: "Regular", price: spec.price, offerPrice: 0 }];

      const doc = {
        foodCode,
        restaurantId: restaurant._id,
        foodName: spec.name,
        description: spec.description,
        category: spec.category,
        otherCategory: "",
        foodType: spec.foodType,
        spiceLevel: spec.spice,
        hasVariants: Boolean(spec.variants && spec.variants.length > 1),
        currency: "INR",
        gstRate: getGstRateForCategory(spec.category),
        variants,
        preparationTime: spec.prep,
        coverImage: foodImages(spec.category, i + codeIndex),
        galleryImages: [foodImages(spec.category, i + codeIndex + 7)],
        isAvailable: true,
        isRecommended: spec.rec,
        isPopular: spec.pop,
        totalOrders: 0,
        displayOrder: i + 1,
        isActive: true,
      };

      const { created, doc: saved } = await upsertOne(
        Food,
        { foodCode },
        doc
      );
      if (created) createdCount += 1;

      const key = `${restaurantKey}:${spec.name}`;
      ctx.foods.set(key, { doc: saved, created });
    }
  }

  return { created: createdCount };
};

export default seedFoods;
