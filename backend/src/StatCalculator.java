public class StatCalculator {
    public static Stats calculate(Movie movie) {
        int atk = movie.runtime / 2;
        int def = (int)(movie.rating * 10);
        int hp = def * 2;
        return new Stats(hp, atk, def);
    }
}
