import java.util.List;

public class Movie {
    public String title;
    public int runtime;
    public double rating;
    public List<String> genres;
    public Stats stats;

    public Movie(String title, int runtime, double rating, List<String> genres) {
        this.title = title;
        this.runtime = runtime;
        this.rating = rating;
        this.genres = genres;
        this.stats = StatCalculator.calculate(this);
    }
}
