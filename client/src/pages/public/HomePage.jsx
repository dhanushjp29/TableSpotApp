import { Link } from "react-router-dom";
import { ROUTES } from "../../routes/routeConstants.js";

function HomePage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-primary/5 to-transparent py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl">
            Find Your Next Favorite Table
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Discover, reserve, and review the best restaurants in town with TableSpot.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={ROUTES.RESTAURANTS} className="btn-primary">
              Explore Restaurants
            </Link>
            <Link
              to={ROUTES.FOODS}
              className="btn-outline"
            >
              Explore Food
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
