import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        Movie movie = new Movie("Inception", 148, 8.8,
                Arrays.asList("Action", "Sci-Fi"));

        Enemy enemy = new Enemy("Phone Scroller", 40, 6);

        System.out.println("Battle Start!");
        System.out.println("Enemy HP: " + enemy.hp);

        int damage = BattleEngine.playerAttack(movie, enemy);
        System.out.println("You dealt " + damage + " damage.");
    }
}
