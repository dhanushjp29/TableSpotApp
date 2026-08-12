import leftCorner from "../../assets/loginpage/left_corner1.png";
import rightCorner from "../../assets/loginpage/right_corner.png";
import line from "../../assets/loginpage/line.png";
import { LOGIN_FOOD_ITEMS, REGISTER_FOOD_ITEMS } from "./authFoodConfig.js";

function Food({ src, x, y, size, rotate, zIndex }) {
  return (
    <img
      src={src}
      alt=""
      className="auth-food"
      style={{ width: `${size}px`, left: x, right: "auto", top: y, transform: `rotate(${rotate}deg)`, zIndex }}
    />
  );
}

function AuthScene({ variant = "login" }) {
  const isRegister = variant === "register";
  const foodItems = isRegister ? REGISTER_FOOD_ITEMS : LOGIN_FOOD_ITEMS;

  return (
    <div className={`auth-scene auth-scene--${variant}`} aria-hidden="true">
      <div className="auth-scene-backdrop" />
      <img src={line} alt="" className="auth-scene-line" />
      <div className="brand-safe-zone" />

      <img
        src={isRegister ? rightCorner : leftCorner}
        alt=""
        className={`auth-corner auth-corner--${isRegister ? "right" : "left"}`}
      />
      {foodItems.map((item) => (
        <Food key={item.src} {...item} />
      ))}
    </div>
  );
}

export default AuthScene;
